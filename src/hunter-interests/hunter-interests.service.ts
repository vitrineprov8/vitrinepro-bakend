import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HunterInterest, HunterInterestStatus } from './hunter-interest.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { User, UserRole, HunterVerificationStatus } from '../users/user.entity';
import { UpdateHunterInterestDto } from './dto/update-hunter-interest.dto';
import { ExpressInterestDto } from './dto/express-interest.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Injectable()
export class HunterInterestsService {
  constructor(
    @InjectRepository(HunterInterest)
    private hunterInterestsRepository: Repository<HunterInterest>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Registers a hunter's interest in a vaga.
   *
   * Rules:
   *  - Vaga must be PUBLISHED and have allowHunters = true.
   *  - The user must not be the vaga creator (cannot express interest in own vaga).
   *  - Unique constraint prevents duplicates; 409 if already registered.
   *  - B4: the hunter must accept the "termos de intermediação" (fee/exclusividade/
   *    máx. candidatos) shown in the drawer — `dto.termsAccepted` must be `true`
   *    (enforced by `ExpressInterestDto`'s `@Equals(true)`).
   */
  async express(
    vagaId: string,
    hunterUser: User,
    dto: ExpressInterestDto,
  ): Promise<HunterInterest> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'status', 'allowHunters', 'createdById'],
    });

    if (!vaga || vaga.status !== VagaStatus.PUBLISHED) {
      throw new NotFoundException('Vaga não encontrada.');
    }

    // B8 — gate do marketplace: hunter precisa estar com perfil verificado
    // (selo "Verificado") para poder trabalhar vagas com fee.
    if (hunterUser.verificationStatus !== HunterVerificationStatus.APPROVED) {
      throw new ForbiddenException({
        code: 'HUNTER_NOT_VERIFIED',
        message: 'Verifique seu perfil para trabalhar vagas com fee.',
      });
    }

    if (!vaga.allowHunters) {
      throw new ForbiddenException('Esta vaga não aceita hunters externos.');
    }

    if (vaga.createdById === hunterUser.id) {
      throw new ForbiddenException('Você não pode se registrar como hunter na própria vaga.');
    }

    const existing = await this.hunterInterestsRepository.findOne({
      where: { vagaId, hunterUserId: hunterUser.id },
    });
    if (existing) {
      throw new ConflictException('Você já registrou interesse nesta vaga como hunter.');
    }

    const interest = this.hunterInterestsRepository.create({
      vagaId,
      hunterUserId: hunterUser.id,
      status: HunterInterestStatus.PENDING,
      // dto.termsAccepted is guaranteed true here (DTO validation), so this
      // timestamp doubles as an acceptance record for future disputes.
      termsAcceptedAt: dto.termsAccepted ? new Date() : null,
    });

    const saved = await this.hunterInterestsRepository.save(interest);

    if (vaga.createdById) {
      void this.notificationsService.create({
        userId: vaga.createdById,
        type: NotificationType.HUNTER_INTEREST_REQUESTED,
        title: 'Novo interesse de hunter',
        message: `Um hunter registrou interesse em trabalhar sua vaga.`,
        // T-E04 — pipeline da vaga (workspace Empresa) tem a aba "Hunters" para
        // aceitar/recusar o interesse.
        link: `/app/empresa/vagas/${vagaId}`,
        metadata: { vagaId, hunterUserId: hunterUser.id },
      });
    }

    return saved;
  }

  /**
   * Lists all hunter interests for the authenticated user.
   * Joins vaga data (title, segment) and includes contact info if ACCEPTED.
   */
  async listMine(hunterUserId: string): Promise<unknown[]> {
    const interests = await this.hunterInterestsRepository
      .createQueryBuilder('hi')
      .innerJoinAndSelect('hi.vaga', 'vaga')
      .where('hi.hunterUserId = :hunterUserId', { hunterUserId })
      .orderBy('hi.createdAt', 'DESC')
      .getMany();

    return interests.map((hi) => ({
      id: hi.id,
      status: hi.status,
      termsAcceptedAt: hi.termsAcceptedAt,
      createdAt: hi.createdAt,
      vaga: hi.vaga
        ? {
            id: hi.vaga.id,
            title: hi.vaga.title,
            slug: hi.vaga.slug,
            segment: hi.vaga.segment,
            status: hi.vaga.status,
            location: hi.vaga.location,
            // B4 — termos mostrados no drawer "Quero esta vaga" ficam disponíveis
            // aqui também para a lista "Meus interesses" (T-H07).
            feePercent: hi.vaga.feePercent,
            feeAmount: hi.vaga.feeAmount,
            maxHunters: hi.vaga.maxHunters,
            exclusivityDays: hi.vaga.exclusivityDays,
            // Only expose the contact phone if the owner has accepted this hunter
            hunterContactPhone:
              hi.status === HunterInterestStatus.ACCEPTED
                ? hi.vaga.hunterContactPhone
                : null,
            contactEmail:
              hi.status === HunterInterestStatus.ACCEPTED
                ? hi.vaga.contactEmail
                : null,
          }
        : null,
    }));
  }

  /**
   * Lists all hunters who expressed interest in a vaga.
   * Only the vaga owner (or admin) can call this endpoint.
   * Returns hunter name, email, phone for direct contact.
   */
  async listByVaga(
    vagaId: string,
    actor: User,
  ): Promise<unknown[]> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'createdById'],
    });

    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    if (vaga.createdById !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para ver os hunters desta vaga.',
      );
    }

    const interests = await this.hunterInterestsRepository
      .createQueryBuilder('hi')
      .innerJoinAndSelect('hi.hunterUser', 'hunter')
      .where('hi.vagaId = :vagaId', { vagaId })
      .orderBy('hi.createdAt', 'DESC')
      .getMany();

    return interests.map((hi) => ({
      id: hi.id,
      status: hi.status,
      createdAt: hi.createdAt,
      hunter: hi.hunterUser
        ? {
            id: hi.hunterUser.id,
            firstName: hi.hunterUser.firstName,
            lastName: hi.hunterUser.lastName,
            email: hi.hunterUser.email,
            phone: hi.hunterUser.phone,
            username: hi.hunterUser.username,
            avatarUrl: hi.hunterUser.avatarUrl,
          }
        : null,
    }));
  }

  /**
   * Accepts or rejects a hunter interest.
   * Only the vaga owner (or admin) can update the status.
   * PENDING → ACCEPTED or REJECTED only.
   */
  async updateStatus(
    vagaId: string,
    hunterUserId: string,
    dto: UpdateHunterInterestDto,
    actor: User,
  ): Promise<HunterInterest> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'createdById', 'maxHunters'],
    });

    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    if (vaga.createdById !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar hunters desta vaga.',
      );
    }

    const interest = await this.hunterInterestsRepository.findOne({
      where: { vagaId, hunterUserId },
    });

    if (!interest) {
      throw new NotFoundException('Interesse de hunter não encontrado.');
    }

    // B4 — RN: nº de hunters ACEITOS simultaneamente é limitado por vaga.maxHunters
    // (design-spec: barra "hunters: 3/5"). Só checa ao aceitar um NOVO hunter —
    // reaceitar o mesmo (idempotência) ou rejeitar nunca é bloqueado por isso.
    if (
      dto.status === HunterInterestStatus.ACCEPTED &&
      interest.status !== HunterInterestStatus.ACCEPTED
    ) {
      const acceptedCount = await this.hunterInterestsRepository.count({
        where: { vagaId, status: HunterInterestStatus.ACCEPTED },
      });
      if (acceptedCount >= vaga.maxHunters) {
        throw new ConflictException(
          `Limite de ${vaga.maxHunters} hunters aceitos nesta vaga já foi atingido.`,
        );
      }
    }

    interest.status = dto.status;
    const saved = await this.hunterInterestsRepository.save(interest);

    void this.notificationsService.create({
      userId: hunterUserId,
      type: NotificationType.HUNTER_INTEREST_DECIDED,
      title:
        dto.status === HunterInterestStatus.ACCEPTED
          ? 'Interesse aceito'
          : 'Interesse recusado',
      message:
        dto.status === HunterInterestStatus.ACCEPTED
          ? 'Seu interesse nesta vaga foi aceito. Você já pode ver os dados de contato.'
          : 'Seu interesse nesta vaga foi recusado.',
      link: `/app/hunter/vagas/${vagaId}`,
      metadata: { vagaId, status: dto.status },
    });

    return saved;
  }
}
