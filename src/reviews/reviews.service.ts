import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HunterReview } from './hunter-review.entity';
import { Placement } from '../placements/placement.entity';
import { UserRole } from '../users/user.entity';
import { TeamContextHelper } from '../teams/team-context.helper';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(HunterReview)
    private reviewsRepository: Repository<HunterReview>,
    @InjectRepository(Placement)
    private placementsRepository: Repository<Placement>,
    private teamContextHelper: TeamContextHelper,
  ) {}

  /**
   * Mesma regra de autorização de `PlacementsService.assertCanManageVaga`
   * (dono da vaga, delegado de time OWNER/MANAGER, ou admin). Duplicado aqui
   * (não importado de `PlacementsModule`) pra manter os módulos desacoplados
   * — é uma checagem pequena e estável.
   */
  private async assertCanManageVaga(
    vagaCreatedById: string | null,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    if (actorRole === UserRole.ADMIN) return;
    if (vagaCreatedById === actorId) return;

    const isTeamLead =
      !!vagaCreatedById &&
      (await this.teamContextHelper.canManageAsTeamLead(vagaCreatedById, actorId));
    if (isTeamLead) return;

    throw new ForbiddenException('Você não tem permissão para avaliar este placement.');
  }

  private async loadPlacementWithVaga(placementId: string): Promise<Placement> {
    const placement = await this.placementsRepository.findOne({
      where: { id: placementId },
      relations: ['vaga'],
    });
    if (!placement) throw new NotFoundException('Placement não encontrado.');
    return placement;
  }

  /** POST /placements/:id/review (B10 — RN-NOVA-07). Imutável — sem update/delete. */
  async create(
    placementId: string,
    actorId: string,
    actorRole: UserRole,
    dto: CreateReviewDto,
  ): Promise<HunterReview> {
    const placement = await this.loadPlacementWithVaga(placementId);

    if (!placement.hunterId) {
      throw new BadRequestException(
        'Contratações diretas (sem hunter) não têm quem avaliar.',
      );
    }

    await this.assertCanManageVaga(placement.vaga?.createdById ?? null, actorId, actorRole);

    // "Após cada placement/encerramento" — precisa ter passado por confirmação
    // (P2). Isso cobre CONFIRMED/GUARANTEE_BROKEN/REPLACED/FEE_RELEASED e
    // exclui HIRED (pendente), DISPUTED e CANCELLED (nunca confirmados).
    if (!placement.confirmedAt) {
      throw new BadRequestException(
        'Só é possível avaliar um placement depois que ele for confirmado.',
      );
    }

    const existing = await this.reviewsRepository.findOne({ where: { placementId } });
    if (existing) {
      throw new ConflictException('Este placement já foi avaliado.');
    }

    const review = this.reviewsRepository.create({
      placementId,
      hunterId: placement.hunterId,
      vagaId: placement.vagaId,
      reviewedById: actorId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      tags: dto.tags ?? null,
    });

    return this.reviewsRepository.save(review);
  }

  /** GET /placements/:id/review — mesma visibilidade da timeline do placement (B9). */
  async findByPlacement(
    placementId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<HunterReview | null> {
    const placement = await this.loadPlacementWithVaga(placementId);

    let canView =
      actorRole === UserRole.ADMIN ||
      placement.hunterId === actorId ||
      placement.markedById === actorId;

    if (!canView && placement.vaga?.createdById) {
      try {
        await this.assertCanManageVaga(placement.vaga.createdById, actorId, actorRole);
        canView = true;
      } catch {
        canView = false;
      }
    }

    if (!canView) {
      throw new ForbiddenException('Você não tem permissão para ver esta avaliação.');
    }

    return this.reviewsRepository.findOne({ where: { placementId } });
  }

  /**
   * GET /me/placements/pending-review — placements da empresa (dono/delegado
   * de time) que já podem ser avaliados (confirmados, hunter-sourced) e ainda
   * não têm review. Alimenta a tab "Avaliações pendentes" (design-spec 05).
   *
   * Inclui dados do hunter e do candidato (via application) — o front precisa
   * exibir "Avalie {hunter}" com nome/avatar, e o cargo/candidato de contexto.
   */
  async listPendingForCompany(actorId: string): Promise<unknown[]> {
    const placements = await this.placementsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.vaga', 'vaga')
      .leftJoinAndSelect('p.hunter', 'hunter')
      .leftJoinAndSelect('p.application', 'application')
      .leftJoin(HunterReview, 'review', 'review.placementId = p.id')
      .where('vaga.createdById = :actorId', { actorId })
      .andWhere('p.hunterId IS NOT NULL')
      .andWhere('p.confirmedAt IS NOT NULL')
      .andWhere('review.id IS NULL')
      .orderBy('p.confirmedAt', 'DESC')
      .getMany();

    return placements.map((p) => ({
      id: p.id,
      vagaId: p.vagaId,
      vagaTitle: p.vaga?.title ?? null,
      confirmedAt: p.confirmedAt,
      candidateName: p.application?.snapshotFullName ?? null,
      hunter: p.hunter
        ? {
            id: p.hunter.id,
            firstName: p.hunter.firstName,
            lastName: p.hunter.lastName,
            username: p.hunter.username,
            avatarUrl: p.hunter.avatarUrl,
          }
        : null,
    }));
  }

  /** Agregação usada no perfil público do hunter (B5 — `HuntersService.getMetrics`). */
  async getHunterStats(hunterId: string): Promise<{ avgRating: number | null; totalReviews: number }> {
    const row = await this.reviewsRepository
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.hunterId = :hunterId', { hunterId })
      .getRawOne<{ avg: string | null; count: string }>();

    const totalReviews = row ? parseInt(row.count, 10) : 0;
    const avgRating =
      row?.avg != null ? Math.round(parseFloat(row.avg) * 10) / 10 : null;

    return { avgRating, totalReviews };
  }
}
