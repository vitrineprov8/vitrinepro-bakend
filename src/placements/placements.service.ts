import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Placement,
  PlacementStatus,
  PLACEMENT_AUTO_CONFIRM_DAYS,
  PLACEMENT_GUARANTEE_DAYS,
  PLACEMENT_HUNTER_SHARE,
  PLACEMENT_PLATFORM_SHARE,
} from './placement.entity';
import { VagaApplication, ApplicationSource } from '../vaga-applications/vaga-application.entity';
import { Vaga } from '../vagas/vaga.entity';
import { User, UserRole } from '../users/user.entity';
import { TeamContextHelper } from '../teams/team-context.helper';
import { MailService } from '../mail/mail.service';
import { MarkHiredDto } from './dto/mark-hired.dto';
import { ContestPlacementDto } from './dto/contest-placement.dto';
import { ReportDepartureDto } from './dto/report-departure.dto';
import { ResolveDisputeDto, DisputeResolution } from './dto/resolve-dispute.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PlacementsService {
  private readonly logger = new Logger(PlacementsService.name);

  constructor(
    @InjectRepository(Placement)
    private placementsRepository: Repository<Placement>,
    @InjectRepository(VagaApplication)
    private applicationsRepository: Repository<VagaApplication>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private teamContextHelper: TeamContextHelper,
    private mailService: MailService,
  ) {}

  /** Same delegation rule as VagaApplicationsService (B15): dono da vaga, ADMIN, ou líder do time do dono. */
  private async assertCanManageVaga(
    vagaCreatedById: string | null,
    actorId: string,
    actorRole: UserRole,
    forbiddenMessage: string,
  ): Promise<void> {
    if (actorRole === UserRole.ADMIN) return;
    if (vagaCreatedById === actorId) return;

    const isTeamLead =
      !!vagaCreatedById &&
      (await this.teamContextHelper.canManageAsTeamLead(vagaCreatedById, actorId));
    if (isTeamLead) return;

    throw new ForbiddenException(forbiddenMessage);
  }

  private computeFee(vaga: Vaga, finalSalary: number): number {
    if (vaga.feePercent != null) {
      return Math.round(((Number(finalSalary) * Number(vaga.feePercent)) / 100) * 100) / 100;
    }
    if (vaga.feeAmount != null) {
      return Number(vaga.feeAmount);
    }
    return 0;
  }

  // ── P1 — Marcar contratado ────────────────────────────────────────────────

  async markHired(
    applicationId: string,
    actorId: string,
    actorRole: UserRole,
    dto: MarkHiredDto,
  ): Promise<Placement> {
    const application = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: ['vaga'],
    });
    if (!application) throw new NotFoundException('Candidatura não encontrada.');
    if (!application.vaga) throw new NotFoundException('Vaga não encontrada.');

    await this.assertCanManageVaga(
      application.vaga.createdById,
      actorId,
      actorRole,
      'Você não tem permissão para marcar esta candidatura como contratada.',
    );

    const existing = await this.placementsRepository.findOne({
      where: { applicationId },
    });
    if (existing) {
      throw new ConflictException('Esta candidatura já tem um placement registrado.');
    }

    const isHunterSourced =
      application.source === ApplicationSource.HUNTER && !!application.submittedByHunterId;

    if (isHunterSourced && dto.termsAccepted !== true) {
      throw new BadRequestException(
        'É necessário aceitar os termos do placement (fee/garantia) para candidatos indicados por hunter.',
      );
    }

    let replacesPlacement: Placement | null = null;
    if (dto.replacesPlacementId) {
      replacesPlacement = await this.placementsRepository.findOne({
        where: { id: dto.replacesPlacementId },
      });
      if (!replacesPlacement) {
        throw new NotFoundException('Placement original da reposição não encontrado.');
      }
      if (replacesPlacement.status !== PlacementStatus.GUARANTEE_BROKEN) {
        throw new BadRequestException(
          'Só é possível vincular uma reposição a um placement com garantia quebrada.',
        );
      }
      if (replacesPlacement.vagaId !== application.vagaId) {
        throw new BadRequestException('A reposição precisa ser para a mesma vaga.');
      }
    }

    const placement = this.placementsRepository.create({
      applicationId,
      vagaId: application.vagaId,
      markedById: actorId,
      hunterId: isHunterSourced ? application.submittedByHunterId : null,
      finalSalary: dto.finalSalary,
      regime: dto.regime ?? null,
      startDate: dto.startDate ?? null,
      termsAcceptedAt: isHunterSourced ? new Date() : null,
    });

    if (isHunterSourced) {
      const feeAmount = this.computeFee(application.vaga, dto.finalSalary);
      placement.feeAmount = feeAmount;
      placement.hunterShareAmount = Math.round(feeAmount * PLACEMENT_HUNTER_SHARE * 100) / 100;
      placement.platformShareAmount = Math.round(feeAmount * PLACEMENT_PLATFORM_SHARE * 100) / 100;
      placement.status = PlacementStatus.HIRED;
    } else {
      // Contratação direta (sem hunter): sem fee/garantia, já nasce confirmada.
      placement.status = PlacementStatus.CONFIRMED;
      placement.confirmedAt = new Date();
    }

    const saved = await this.placementsRepository.save(placement);

    if (replacesPlacement) {
      replacesPlacement.replacedByPlacementId = saved.id;
      replacesPlacement.status = PlacementStatus.REPLACED;
      await this.placementsRepository.save(replacesPlacement);
    }

    if (isHunterSourced && placement.hunterId) {
      const hunter = await this.usersRepository.findOne({ where: { id: placement.hunterId } });
      if (hunter) {
        void this.mailService.sendPlacementHired(
          hunter.email,
          hunter.firstName,
          application.vaga.title,
          placement.hunterShareAmount as number,
        );
      }
    }

    return saved;
  }

  // ── P2 — Confirmação bilateral ────────────────────────────────────────────

  async confirm(placementId: string, actorId: string, actorRole: UserRole): Promise<Placement> {
    const placement = await this.loadWithVaga(placementId);

    if (actorRole !== UserRole.ADMIN && placement.hunterId !== actorId) {
      throw new ForbiddenException('Apenas o hunter da indicação pode confirmar este placement.');
    }
    if (placement.status !== PlacementStatus.HIRED) {
      throw new BadRequestException('Este placement não está aguardando confirmação.');
    }

    return this.applyConfirmation(placement, { autoConfirmed: false });
  }

  private async applyConfirmation(
    placement: Placement,
    opts: { autoConfirmed: boolean },
  ): Promise<Placement> {
    const now = new Date();
    placement.status = PlacementStatus.CONFIRMED;
    placement.confirmedAt = now;
    placement.autoConfirmed = opts.autoConfirmed;
    placement.guaranteeEndsAt = new Date(now.getTime() + PLACEMENT_GUARANTEE_DAYS * DAY_MS);

    const saved = await this.placementsRepository.save(placement);

    const vaga = await this.vagasRepository.findOne({ where: { id: saved.vagaId as string } });
    if (vaga?.createdById) {
      const company = await this.usersRepository.findOne({ where: { id: vaga.createdById } });
      if (company) {
        void this.mailService.sendPlacementConfirmed(
          company.email,
          company.firstName,
          vaga.title,
          opts.autoConfirmed,
          saved.guaranteeEndsAt as Date,
          saved.id,
        );
      }
    }

    return saved;
  }

  async contest(
    placementId: string,
    actorId: string,
    dto: ContestPlacementDto,
  ): Promise<Placement> {
    const placement = await this.loadWithVaga(placementId);

    if (placement.hunterId !== actorId) {
      throw new ForbiddenException('Apenas o hunter da indicação pode contestar este placement.');
    }
    if (placement.status !== PlacementStatus.HIRED) {
      throw new BadRequestException('Este placement não está aguardando confirmação.');
    }

    placement.status = PlacementStatus.DISPUTED;
    placement.disputedAt = new Date();
    placement.disputeReason = dto.reason;

    const saved = await this.placementsRepository.save(placement);

    const vaga = await this.vagasRepository.findOne({ where: { id: saved.vagaId as string } });
    if (vaga?.createdById) {
      const company = await this.usersRepository.findOne({ where: { id: vaga.createdById } });
      if (company) {
        void this.mailService.sendPlacementDisputed(
          company.email,
          company.firstName,
          vaga.title,
          dto.reason,
          saved.id,
        );
      }
    }

    return saved;
  }

  /** A3 — admin resolve uma disputa: confirma (segue o fluxo normal) ou cancela o placement. */
  async resolveDispute(
    placementId: string,
    actorRole: UserRole,
    dto: ResolveDisputeDto,
  ): Promise<Placement> {
    if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Só administradores podem resolver disputas.');
    }

    const placement = await this.loadWithVaga(placementId);
    if (placement.status !== PlacementStatus.DISPUTED) {
      throw new BadRequestException('Este placement não está em disputa.');
    }

    if (dto.resolution === DisputeResolution.CONFIRM) {
      placement.disputeResolvedAt = new Date();
      await this.placementsRepository.save(placement);
      return this.applyConfirmation(placement, { autoConfirmed: false });
    }

    placement.status = PlacementStatus.CANCELLED;
    placement.disputeResolvedAt = new Date();
    return this.placementsRepository.save(placement);
  }

  // ── P4 — Quebra de garantia / reposição ───────────────────────────────────

  async reportDeparture(
    placementId: string,
    actorId: string,
    actorRole: UserRole,
    dto: ReportDepartureDto,
  ): Promise<Placement> {
    const placement = await this.loadWithVaga(placementId);

    await this.assertCanManageVaga(
      placement.vaga?.createdById ?? null,
      actorId,
      actorRole,
      'Você não tem permissão para reportar a saída deste candidato.',
    );

    if (!placement.hunterId) {
      throw new BadRequestException(
        'Contratações diretas (sem hunter) não têm garantia — nada a reportar.',
      );
    }
    if (placement.status !== PlacementStatus.CONFIRMED) {
      throw new BadRequestException(
        'Só é possível reportar saída de um placement confirmado e dentro da garantia.',
      );
    }
    if (!placement.guaranteeEndsAt || placement.guaranteeEndsAt < new Date()) {
      throw new BadRequestException('O período de garantia deste placement já expirou.');
    }

    placement.status = PlacementStatus.GUARANTEE_BROKEN;
    placement.departureReportedAt = new Date();
    placement.departureDate = dto.departureDate ?? new Date().toISOString().slice(0, 10);
    placement.departureReason = dto.reason;

    const saved = await this.placementsRepository.save(placement);

    const hunter = await this.usersRepository.findOne({ where: { id: placement.hunterId } });
    if (hunter && placement.vaga) {
      void this.mailService.sendPlacementGuaranteeBroken(
        hunter.email,
        hunter.firstName,
        placement.vaga.title,
        dto.reason,
      );
    }

    return saved;
  }

  // ── P3 — Timeline ─────────────────────────────────────────────────────────

  async getTimeline(
    placementId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<{
    placement: Placement;
    steps: Array<{ key: string; label: string; at: Date | null; done: boolean }>;
  }> {
    const placement = await this.loadWithVaga(placementId);

    let canView =
      actorRole === UserRole.ADMIN ||
      placement.hunterId === actorId ||
      placement.markedById === actorId;

    if (!canView && placement.vaga?.createdById) {
      try {
        await this.assertCanManageVaga(placement.vaga.createdById, actorId, actorRole, 'forbidden');
        canView = true;
      } catch {
        canView = false;
      }
    }

    if (!canView) {
      throw new ForbiddenException('Você não tem permissão para ver este placement.');
    }

    const steps = [
      { key: 'HIRED', label: 'Contratado', at: placement.createdAt, done: true },
      {
        key: 'CONFIRMED',
        label: 'Confirmado',
        at: placement.confirmedAt,
        done: !!placement.confirmedAt,
      },
      {
        key: 'GUARANTEE',
        label: 'Em garantia',
        at: placement.confirmedAt,
        done:
          !!placement.confirmedAt &&
          [PlacementStatus.CONFIRMED, PlacementStatus.GUARANTEE_BROKEN, PlacementStatus.REPLACED, PlacementStatus.FEE_RELEASED].includes(
            placement.status,
          ),
      },
      {
        key: 'FEE_RELEASED',
        label: 'Fee liberado',
        at: placement.feeReleasedAt,
        done: !!placement.feeReleasedAt,
      },
    ];

    return { placement, steps };
  }

  // ── Listagens ─────────────────────────────────────────────────────────────

  async listForHunter(hunterId: string): Promise<Placement[]> {
    return this.placementsRepository.find({
      where: { hunterId },
      relations: ['vaga'],
      order: { createdAt: 'DESC' },
    });
  }

  async listForCompany(actorId: string): Promise<Placement[]> {
    const vagas = await this.vagasRepository.find({
      where: { createdById: actorId },
      select: ['id'],
    });
    const vagaIds = vagas.map((v) => v.id);
    if (vagaIds.length === 0) return [];

    return this.placementsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.vaga', 'vaga')
      .where('p.vagaId IN (:...vagaIds)', { vagaIds })
      .orderBy('p.createdAt', 'DESC')
      .getMany();
  }

  private async loadWithVaga(placementId: string): Promise<Placement> {
    const placement = await this.placementsRepository.findOne({
      where: { id: placementId },
      relations: ['vaga'],
    });
    if (!placement) throw new NotFoundException('Placement não encontrado.');
    return placement;
  }

  // ── Crons (§P2 auto-confirm 7d / garantia 90d) ────────────────────────────
  // Rodam diariamente. Idempotentes — só afetam linhas que já cruzaram o
  // limiar de tempo, então rodar mais de uma vez no mesmo dia não tem efeito
  // colateral.

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async autoConfirmDueSweep(): Promise<void> {
    await this.runAutoConfirmSweep();
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async releaseFeeDueSweep(): Promise<void> {
    await this.runFeeReleaseSweep();
  }

  /**
   * P2 — auto-confirm: qualquer placement HIRED criado há mais de 7 dias é
   * confirmado automaticamente (o hunter não respondeu a tempo).
   */
  async runAutoConfirmSweep(): Promise<number> {
    const threshold = new Date(Date.now() - PLACEMENT_AUTO_CONFIRM_DAYS * DAY_MS);
    const due = await this.placementsRepository.find({
      where: { status: PlacementStatus.HIRED },
    });
    const overdue = due.filter((p) => p.createdAt <= threshold);

    for (const placement of overdue) {
      try {
        await this.applyConfirmation(placement, { autoConfirmed: true });
      } catch (err) {
        this.logger.error(
          `Falha ao auto-confirmar placement ${placement.id}: ${(err as Error).message}`,
        );
      }
    }
    return overdue.length;
  }

  /**
   * Garantia expirada sem quebra → libera o fee ao hunter.
   */
  async runFeeReleaseSweep(): Promise<number> {
    const now = new Date();
    const candidates = await this.placementsRepository.find({
      where: { status: PlacementStatus.CONFIRMED },
      relations: ['vaga'],
    });
    const overdue = candidates.filter((p) => p.guaranteeEndsAt && p.guaranteeEndsAt <= now);

    for (const placement of overdue) {
      placement.status = PlacementStatus.FEE_RELEASED;
      placement.feeReleasedAt = now;
      const saved = await this.placementsRepository.save(placement);

      if (saved.hunterId) {
        const hunter = await this.usersRepository.findOne({ where: { id: saved.hunterId } });
        if (hunter && placement.vaga) {
          void this.mailService.sendPlacementFeeReleased(
            hunter.email,
            hunter.firstName,
            placement.vaga.title,
            saved.hunterShareAmount as number,
          );
        }
      }
    }
    return overdue.length;
  }

  /**
   * QA-only — força a transição de tempo (auto-confirm 7d / liberação de fee
   * 90d) de UM placement específico, ignorando o limiar de data. Existe só
   * para permitir validar de ponta a ponta (HTTP real, sem mock) a mecânica
   * das duas transições cron-based sem esperar os dias reais se passarem —
   * mesmo espírito do "token em dev" já usado em B3/B7/B17. Bloqueado em
   * produção e restrito a ADMIN (ver guard no controller).
   */
  async qaForceAdvance(placementId: string): Promise<Placement> {
    const placement = await this.loadWithVaga(placementId);

    if (placement.status === PlacementStatus.HIRED) {
      return this.applyConfirmation(placement, { autoConfirmed: true });
    }

    if (placement.status === PlacementStatus.CONFIRMED) {
      placement.status = PlacementStatus.FEE_RELEASED;
      placement.feeReleasedAt = new Date();
      const saved = await this.placementsRepository.save(placement);

      if (saved.hunterId) {
        const hunter = await this.usersRepository.findOne({ where: { id: saved.hunterId } });
        if (hunter && placement.vaga) {
          void this.mailService.sendPlacementFeeReleased(
            hunter.email,
            hunter.firstName,
            placement.vaga.title,
            saved.hunterShareAmount as number,
          );
        }
      }
      return saved;
    }

    throw new BadRequestException(
      `Não há transição de tempo pendente para o status atual (${placement.status}).`,
    );
  }
}
