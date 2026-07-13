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
  DEFAULT_PLATFORM_SHARE_PERCENT,
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
import { UpdatePlacementSplitDto } from './dto/update-placement-split.dto';
import { QueryAdminPlacementsDto } from './dto/query-admin-placements.dto';
import { AdminPlacementActionDto } from './dto/admin-placement-action.dto';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuditAction } from '../admin-audit-log/admin-audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { paginate, PaginatedResult } from '../common/paginate.helper';

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
    private adminAuditLogService: AdminAuditLogService,
    private notificationsService: NotificationsService,
  ) {}

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

  private async resolvePlatformSharePercent(vagaCreatedById: string | null): Promise<number> {
    if (!vagaCreatedById) return DEFAULT_PLATFORM_SHARE_PERCENT;

    const owner = await this.usersRepository.findOne({
      where: { id: vagaCreatedById },
      select: ['id', 'placementPlatformSharePercent'],
    });

    return owner?.placementPlatformSharePercent ?? DEFAULT_PLATFORM_SHARE_PERCENT;
  }

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
      const platformSharePercent = await this.resolvePlatformSharePercent(
        application.vaga.createdById,
      );
      const hunterSharePercent = 100 - platformSharePercent;

      placement.feeAmount = feeAmount;
      placement.hunterShareAmount = Math.round(feeAmount * (hunterSharePercent / 100) * 100) / 100;
      placement.platformShareAmount = Math.round(feeAmount * (platformSharePercent / 100) * 100) / 100;
      placement.platformSharePercentApplied = platformSharePercent;
      placement.status = PlacementStatus.HIRED;
    } else {
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
        void this.notificationsService.create({
          userId: hunter.id,
          type: NotificationType.PLACEMENT_HIRED,
          title: 'Indicação contratada!',
          message: `Sua indicação para "${application.vaga.title}" foi marcada como contratada. Confirme o placement para liberar a garantia.`,
          // T-H09 — página real de acompanhamento de ganhos/placements do hunter.
          link: `/app/hunter/ganhos`,
          metadata: { placementId: saved.id, vagaId: application.vagaId },
        });
      }
    }

    return saved;
  }

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
        void this.notificationsService.create({
          userId: company.id,
          type: NotificationType.PLACEMENT_CONFIRMED,
          title: 'Placement confirmado',
          message: `O placement de "${vaga.title}" foi confirmado${opts.autoConfirmed ? ' automaticamente' : ' pelo hunter'}. Garantia até ${(saved.guaranteeEndsAt as Date).toLocaleDateString('pt-BR')}.`,
          // A vaga pode pertencer a uma conta empresa ou a um hunter que contratou
          // diretamente (sem passar por consultoria) — best-effort per persona;
          // caso de vaga gerida por membro de time de consultoria continua caindo
          // no fallback hunter (gap conhecido, ver CLAUDE.md).
          link: company.isCompany ? `/app/empresa/vagas/${vaga.id}` : `/app/hunter/vagas/${vaga.id}`,
          metadata: { placementId: saved.id, vagaId: vaga.id },
        });
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
        void this.notificationsService.create({
          userId: company.id,
          type: NotificationType.PLACEMENT_DISPUTED,
          title: 'Placement contestado',
          message: `O hunter contestou o placement de "${vaga.title}": ${dto.reason}`,
          // Ver nota em applyConfirmation() sobre a heurística empresa/hunter.
          link: company.isCompany ? `/app/empresa/vagas/${vaga.id}` : `/app/hunter/vagas/${vaga.id}`,
          metadata: { placementId: saved.id, vagaId: vaga.id },
        });
      }
    }

    return saved;
  }

  async resolveDispute(
    placementId: string,
    actorId: string,
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

    const statusBefore = placement.status;

    let saved: Placement;
    if (dto.resolution === DisputeResolution.CONFIRM) {
      placement.disputeResolvedAt = new Date();
      await this.placementsRepository.save(placement);
      saved = await this.applyConfirmation(placement, { autoConfirmed: false });
    } else {
      placement.status = PlacementStatus.CANCELLED;
      placement.disputeResolvedAt = new Date();
      saved = await this.placementsRepository.save(placement);
    }

    void this.adminAuditLogService.record({
      adminId: actorId,
      action: AdminAuditAction.PLACEMENT_DISPUTE_RESOLVE,
      targetType: 'Placement',
      targetId: placement.id,
      reason: dto.note ?? null,
      payloadBefore: { status: statusBefore },
      payloadAfter: { status: saved.status, resolution: dto.resolution },
    });

    return saved;
  }

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
      void this.notificationsService.create({
        userId: hunter.id,
        type: NotificationType.PLACEMENT_GUARANTEE_BROKEN,
        title: 'Garantia quebrada',
        message: `A empresa reportou saída do candidato de "${placement.vaga.title}": ${dto.reason}`,
        // T-H09 — página real de acompanhamento de ganhos/placements do hunter.
        link: `/app/hunter/ganhos`,
        metadata: { placementId: saved.id },
      });
    }

    return saved;
  }

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

  /**
   * T-T07 — Consultoria: Faturamento & Ganhos (tabela de placements do time,
   * com colunas extras Cliente e Hunter/Membro responsável).
   *
   * Escopo: mesma regra de `VagasService.listMine`/`listByTeam` de applications
   * (company do quotaOwner OU createdById de qualquer membro ATIVO do time).
   *
   * Nota (dívida conhecida, ver CLAUDE.md): contratações diretas feitas pelo
   * próprio time (sem hunter externo) NÃO têm feeAmount calculado hoje — o
   * cálculo de fee só roda em `markHired()` quando `isHunterSourced`. Este
   * endpoint retorna TODOS os placements do escopo do time mesmo assim
   * (feeAmount null nesses casos) para não esconder o placement da tabela;
   * os KPIs de `GET /stats/consultoria/ganhos` cobrem só a parte com fee
   * calculado (mesma limitação, pré-existente do B12).
   */
  async listForTeam(actor: User): Promise<unknown[]> {
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    if (!ctx.team) {
      throw new ForbiddenException(
        'Disponível apenas para workspaces de consultoria (time).',
      );
    }

    const teamUserIds = await this.teamContextHelper.getTeamUserIds(ctx.quotaOwner.id);

    const vagaQb = this.vagasRepository
      .createQueryBuilder('vaga')
      .leftJoin('vaga.company', 'company')
      .select(['vaga.id'])
      .where(
        '(company.ownerId = :ownerId OR vaga.createdById IN (:...teamUserIds))',
        { ownerId: ctx.quotaOwner.id, teamUserIds },
      );
    const vagaRows = await vagaQb.getMany();
    const vagaIds = vagaRows.map((v) => v.id);
    if (vagaIds.length === 0) return [];

    const placements = await this.placementsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.vaga', 'vaga')
      .leftJoin('vaga.company', 'company')
      .leftJoin('p.hunter', 'hunter')
      .leftJoin('p.markedBy', 'markedBy')
      .addSelect(['company.id', 'company.name', 'company.logoUrl'])
      .addSelect(['hunter.id', 'hunter.firstName', 'hunter.lastName', 'hunter.avatarUrl'])
      .addSelect(['markedBy.id', 'markedBy.firstName', 'markedBy.lastName', 'markedBy.avatarUrl'])
      .where('p.vagaId IN (:...vagaIds)', { vagaIds })
      .orderBy('p.createdAt', 'DESC')
      .getMany();

    return placements.map((p) => ({
      id: p.id,
      vagaId: p.vagaId,
      vagaTitle: p.vaga?.title ?? null,
      company: p.vaga?.company
        ? { id: p.vaga.company.id, name: p.vaga.company.name, logoUrl: p.vaga.company.logoUrl }
        : null,
      // "Hunter/Membro responsável": hunter externo se veio de indicação, senão
      // quem marcou a contratação (membro do time que geriu o processo direto).
      responsavel: p.hunter
        ? {
            id: p.hunter.id,
            firstName: p.hunter.firstName,
            lastName: p.hunter.lastName,
            avatarUrl: p.hunter.avatarUrl,
            isExternalHunter: true,
          }
        : p.markedBy
          ? {
              id: p.markedBy.id,
              firstName: p.markedBy.firstName,
              lastName: p.markedBy.lastName,
              avatarUrl: p.markedBy.avatarUrl,
              isExternalHunter: false,
            }
          : null,
      finalSalary: p.finalSalary,
      feeAmount: p.feeAmount,
      status: p.status,
      confirmedAt: p.confirmedAt,
      feeReleasedAt: p.feeReleasedAt,
      createdAt: p.createdAt,
    }));
  }

  private async loadWithVaga(placementId: string): Promise<Placement> {
    const placement = await this.placementsRepository.findOne({
      where: { id: placementId },
      relations: ['vaga'],
    });
    if (!placement) throw new NotFoundException('Placement não encontrado.');
    return placement;
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async autoConfirmDueSweep(): Promise<void> {
    await this.runAutoConfirmSweep();
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async releaseFeeDueSweep(): Promise<void> {
    await this.runFeeReleaseSweep();
  }

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
          void this.notificationsService.create({
            userId: hunter.id,
            type: NotificationType.PLACEMENT_FEE_RELEASED,
            title: 'Comissão liberada',
            message: `Sua comissão de "${placement.vaga.title}" foi liberada.`,
            // T-H09 — página real de acompanhamento de ganhos/placements do hunter.
            link: `/app/hunter/ganhos`,
            metadata: { placementId: saved.id },
          });
        }
      }
    }
    return overdue.length;
  }

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
          void this.notificationsService.create({
            userId: hunter.id,
            type: NotificationType.PLACEMENT_FEE_RELEASED,
            title: 'Comissão liberada',
            message: `Sua comissão de "${placement.vaga.title}" foi liberada.`,
            // T-H09 — página real de acompanhamento de ganhos/placements do hunter.
            link: `/app/hunter/ganhos`,
            metadata: { placementId: saved.id },
          });
        }
      }
      return saved;
    }

    throw new BadRequestException(
      `Não há transição de tempo pendente para o status atual (${placement.status}).`,
    );
  }

  async adminListCompanies(
    page: number,
    limit: number,
  ): Promise<{
    data: Array<{
      id: string;
      companyName: string | null;
      email: string;
      plan: string;
      vagasCount: number;
      placementsCount: number;
      platformSharePercent: number;
      isCustomSplit: boolean;
    }>;
    total: number;
    page: number;
    lastPage: number;
  }> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const skip = (safePage - 1) * safeLimit;

    const [companies, total] = await this.usersRepository.findAndCount({
      where: { isCompany: true },
      select: ['id', 'companyName', 'email', 'plan', 'placementPlatformSharePercent'],
      order: { companyName: 'ASC' },
      skip,
      take: safeLimit,
    });

    const data = await Promise.all(
      companies.map(async (c) => {
        const vagasCount = await this.vagasRepository.count({ where: { createdById: c.id } });
        const placementsCount = await this.placementsRepository
          .createQueryBuilder('p')
          .innerJoin('p.vaga', 'vaga')
          .where('vaga.createdById = :ownerId', { ownerId: c.id })
          .getCount();

        return {
          id: c.id,
          companyName: c.companyName,
          email: c.email,
          plan: c.plan,
          vagasCount,
          placementsCount,
          platformSharePercent: c.placementPlatformSharePercent ?? DEFAULT_PLATFORM_SHARE_PERCENT,
          isCustomSplit: c.placementPlatformSharePercent !== null,
        };
      }),
    );

    return { data, total, page: safePage, lastPage: Math.ceil(total / safeLimit) };
  }

  async adminUpdatePlacementSplit(
    companyId: string,
    adminId: string,
    dto: UpdatePlacementSplitDto,
  ): Promise<{
    id: string;
    platformSharePercent: number;
    placementSplitHistory: User['placementSplitHistory'];
  }> {
    const company = await this.usersRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (!company.isCompany) {
      throw new BadRequestException('Esta conta não é uma conta empresa.');
    }

    const previousPercent = company.placementPlatformSharePercent;

    company.placementPlatformSharePercent = dto.platformSharePercent;
    company.placementSplitHistory = [
      ...(company.placementSplitHistory ?? []),
      {
        changedAt: new Date().toISOString(),
        changedByAdminId: adminId,
        previousPercent,
        newPercent: dto.platformSharePercent,
        reason: dto.reason,
      },
    ];

    const saved = await this.usersRepository.save(company);

    void this.mailService.sendPlacementSplitChanged(
      saved.email,
      saved.companyName ?? saved.firstName,
      dto.platformSharePercent,
      dto.reason,
    );

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.PLACEMENT_SPLIT_UPDATE,
      targetType: 'User',
      targetId: saved.id,
      reason: dto.reason,
      payloadBefore: { platformSharePercent: previousPercent },
      payloadAfter: { platformSharePercent: dto.platformSharePercent },
    });

    return {
      id: saved.id,
      platformSharePercent: saved.placementPlatformSharePercent as number,
      placementSplitHistory: saved.placementSplitHistory,
    };
  }

  /**
   * GET /admin/placements (A4 — auditoria global) e também usado por A3
   * (Disputas) passando `status: DISPUTED` — evita duplicar a mesma consulta
   * com join em dois lugares. Devolve candidato/vaga/hunter/empresa
   * resumidos, o suficiente pra tabela do admin sem expor a entidade inteira.
   */
  async adminListPlacements(dto: QueryAdminPlacementsDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const qb = this.placementsRepository
      .createQueryBuilder('p')
      .leftJoin('p.vaga', 'vaga')
      .leftJoin('vaga.createdBy', 'company')
      .leftJoin('p.hunter', 'hunter')
      .leftJoin('p.application', 'application')
      .addSelect(['vaga.id', 'vaga.title', 'vaga.slug'])
      .addSelect(['company.id', 'company.firstName', 'company.lastName', 'company.companyName', 'company.email', 'company.isCompany'])
      .addSelect(['hunter.id', 'hunter.firstName', 'hunter.lastName', 'hunter.email'])
      .addSelect(['application.id', 'application.snapshotFullName'])
      .orderBy('p.createdAt', 'DESC');

    if (dto.status) qb.andWhere('p.status = :status', { status: dto.status });
    if (dto.vagaId) qb.andWhere('p.vagaId = :vagaId', { vagaId: dto.vagaId });
    if (dto.hunterId) qb.andWhere('p.hunterId = :hunterId', { hunterId: dto.hunterId });
    if (dto.companyId) qb.andWhere('vaga.createdById = :companyId', { companyId: dto.companyId });

    const result = await paginate(qb, dto.page, dto.limit);
    return {
      ...result,
      data: result.data.map((p) => ({
        id: p.id,
        status: p.status,
        finalSalary: p.finalSalary,
        feeAmount: p.feeAmount,
        hunterShareAmount: p.hunterShareAmount,
        platformShareAmount: p.platformShareAmount,
        confirmedAt: p.confirmedAt,
        guaranteeEndsAt: p.guaranteeEndsAt,
        feeReleasedAt: p.feeReleasedAt,
        disputedAt: p.disputedAt,
        disputeReason: p.disputeReason,
        createdAt: p.createdAt,
        candidateName: p.application?.snapshotFullName ?? null,
        vaga: p.vaga ? { id: p.vaga.id, title: p.vaga.title, slug: p.vaga.slug } : null,
        company: p.vaga?.createdBy
          ? {
              id: p.vaga.createdBy.id,
              name: p.vaga.createdBy.isCompany
                ? (p.vaga.createdBy.companyName ?? p.vaga.createdBy.email)
                : `${p.vaga.createdBy.firstName ?? ''} ${p.vaga.createdBy.lastName ?? ''}`.trim(),
              email: p.vaga.createdBy.email,
            }
          : null,
        hunter: p.hunter
          ? { id: p.hunter.id, name: `${p.hunter.firstName ?? ''} ${p.hunter.lastName ?? ''}`.trim(), email: p.hunter.email }
          : null,
      })),
    };
  }

  /**
   * POST /admin/placements/:id/force-release-fee (A4). Espelha manualmente a
   * transição que o cron `runFeeReleaseSweep` faria — útil quando a empresa
   * pede liberação antecipada (fora da régua de 90 dias) ou quando um caso
   * excepcional trava o cron. Só a partir de CONFIRMED, mesmo motivo do cron.
   */
  async adminForceReleaseFee(
    placementId: string,
    adminId: string,
    dto: AdminPlacementActionDto,
  ): Promise<Placement> {
    const placement = await this.loadWithVaga(placementId);
    if (placement.status !== PlacementStatus.CONFIRMED) {
      throw new BadRequestException(
        'Só é possível forçar liberação de fee de um placement CONFIRMED.',
      );
    }

    const statusBefore = placement.status;
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
        void this.notificationsService.create({
          userId: hunter.id,
          type: NotificationType.PLACEMENT_FEE_RELEASED,
          title: 'Comissão liberada',
          message: `Sua comissão de "${placement.vaga.title}" foi liberada antecipadamente por um administrador.`,
          link: `/app/hunter/ganhos`,
          metadata: { placementId: saved.id },
        });
      }
    }

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.PLACEMENT_FORCE_FEE_RELEASE,
      targetType: 'Placement',
      targetId: saved.id,
      reason: dto.reason,
      payloadBefore: { status: statusBefore },
      payloadAfter: { status: saved.status, feeReleasedAt: saved.feeReleasedAt },
    });

    return saved;
  }

  /**
   * POST /admin/placements/:id/force-refund (A4). "Estorno" aqui é só o
   * registro/parada da régua do placement (CANCELLED) — não existe
   * processamento financeiro real (sem gateway de pagamento, ver B11/B25),
   * então nenhum valor é de fato devolvido por este endpoint. O motivo fica
   * no audit log pra o time financeiro agir por fora, manualmente, se a
   * empresa realmente precisar de reembolso. Documentado como gap conhecido.
   */
  async adminForceRefund(
    placementId: string,
    adminId: string,
    dto: AdminPlacementActionDto,
  ): Promise<Placement> {
    const placement = await this.loadWithVaga(placementId);
    const notRefundable: PlacementStatus[] = [
      PlacementStatus.CANCELLED,
      PlacementStatus.REPLACED,
    ];
    if (notRefundable.includes(placement.status)) {
      throw new BadRequestException(
        `Não é possível marcar estorno para um placement ${placement.status}.`,
      );
    }

    const statusBefore = placement.status;
    placement.status = PlacementStatus.CANCELLED;
    const saved = await this.placementsRepository.save(placement);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.PLACEMENT_FORCE_REFUND,
      targetType: 'Placement',
      targetId: saved.id,
      reason: dto.reason,
      payloadBefore: { status: statusBefore },
      payloadAfter: { status: saved.status },
    });

    return saved;
  }
}
