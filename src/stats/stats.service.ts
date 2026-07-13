import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { User, HunterVerificationStatus, PlanStatus } from '../users/user.entity';
import { Placement, PlacementStatus } from '../placements/placement.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import {
  HunterInterest,
  HunterInterestStatus,
} from '../hunter-interests/hunter-interest.entity';
import {
  CouponRedemption,
  RedemptionStatus,
} from '../coupons/coupon-redemption.entity';
import { SavedVaga } from '../saved-vagas/saved-vaga.entity';
import { TeamContextHelper } from '../teams/team-context.helper';
import { PLAN_PRICES_BRL } from '../plans/plan-limits';

export interface HomeStats {
  /** Vagas PUBLISHED e não expiradas. */
  openVagas: number;
  /** Contas de profissionais (não-empresa). */
  professionals: number;
  /** Contas de empresa. */
  companies: number;
}

/** B12 — cards do dashboard hunter (`/app/hunter`). */
export interface HunterDashboardStats {
  ganhosNoMes: number;
  placementsEmAndamento: number;
  candidatosEmProcessosAtivos: number;
  indicacoesAguardandoResposta: number;
}

/** B12 — cards de `/app/hunter/ganhos` (T-H09). */
export interface HunterGanhosStats {
  aReceber: number;
  recebidoNoAno: number;
  placementsConfirmados: number;
  emGarantia: number;
}

/** B12 — cards do dashboard de empresa (workspace Empresa, §05). */
export interface EmpresaDashboardStats {
  vagasAbertas: number;
  candidatosNovos7d: number;
  huntersTrabalhando: number;
  contratacoesNoAno: number;
}

/**
 * Candidato — cards do topo de `/app/candidato` (T-C02).
 *
 * `visualizacoesPerfil7d` NÃO é rastreado hoje (não existe nenhuma tabela de
 * analytics/pageview no schema — ver PLANO_DESENVOLVIMENTO.md OPS6) — vem
 * sempre `null`, e o frontend mostra "—" em vez de inventar um número.
 */
export interface CandidatoDashboardStats {
  candidaturasAtivas: number;
  vagasSalvas: number;
  visualizacoesPerfil7d: null;
}

export interface PipelineOverviewEntry {
  stage: string;
  count: number;
}

export interface ActivityFeedEntry {
  vagaId: string;
  applicationId: string;
  stage: string;
  enteredAt: string;
  byUserId: string;
}

/** B12 — cards + pipeline overview + feed do dashboard de consultoria (§04). */
export interface ConsultoriaDashboardStats {
  vagasAtivas: number;
  candidatosEmProcesso: number;
  placementsNoMes: number;
  receitaDoMes: number;
  pipelineOverview: PipelineOverviewEntry[];
  atividadeRecente: ActivityFeedEntry[];
}

/** B12 — "Placements & Ganhos" do time (consultoria). */
export interface ConsultoriaGanhosStats {
  aReceber: number;
  recebidoNoAno: number;
  placements: number;
  ticketMedioFee: number | null;
}

/** B12 — painel admin (§06). */
export interface AdminDashboardStats {
  gmvMes: number;
  takePlataformaMes: number;
  placementsMes: number;
  huntersVerificados: number;
  vagasAtivas: number;
  mrr: number;
  disputasAbertas: number;
  verificacoesPendentes: number;
  cuponsAValidar: number;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfYear(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Vaga)
    private readonly vagasRepository: Repository<Vaga>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Placement)
    private readonly placementsRepository: Repository<Placement>,
    @InjectRepository(VagaApplication)
    private readonly vagaApplicationsRepository: Repository<VagaApplication>,
    @InjectRepository(HunterInterest)
    private readonly hunterInterestsRepository: Repository<HunterInterest>,
    @InjectRepository(CouponRedemption)
    private readonly couponRedemptionsRepository: Repository<CouponRedemption>,
    @InjectRepository(SavedVaga)
    private readonly savedVagasRepository: Repository<SavedVaga>,
    private readonly teamContextHelper: TeamContextHelper,
  ) {}

  /**
   * Contadores públicos para a Home (gap B12 — parcial).
   *
   * Apenas métricas calculáveis a partir do schema atual.
   * Fees pagos / placements / hunters verificados dependem de B9/B11/B8 e
   * ainda não existem — o frontend cobre essas com mock.
   */
  async home(): Promise<HomeStats> {
    const [openVagas, professionals, companies] = await Promise.all([
      this.vagasRepository
        .createQueryBuilder('vaga')
        .where('vaga.status = :status', { status: VagaStatus.PUBLISHED })
        .andWhere('(vaga.deadline IS NULL OR vaga.deadline > NOW())')
        .getCount(),
      this.usersRepository.count({ where: { isCompany: false } }),
      this.usersRepository.count({ where: { isCompany: true } }),
    ]);

    return { openVagas, professionals, companies };
  }

  // ── Hunter ───────────────────────────────────────────────────────────────

  /** `GET /stats/hunter` — 4 cards do topo de `/app/hunter`. */
  async hunterDashboard(hunterId: string): Promise<HunterDashboardStats> {
    const monthStart = startOfMonth();

    const [ganhosRow, placementsEmAndamento, candidatosEmProcessosAtivos, indicacoesAguardandoResposta] =
      await Promise.all([
        this.placementsRepository
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.hunterShareAmount), 0)', 'sum')
          .where('p.hunterId = :hunterId', { hunterId })
          .andWhere('p.confirmedAt >= :monthStart', { monthStart })
          .getRawOne<{ sum: string }>(),
        this.placementsRepository.count({
          where: [
            { hunterId, status: PlacementStatus.HIRED },
            { hunterId, status: PlacementStatus.CONFIRMED },
            { hunterId, status: PlacementStatus.DISPUTED },
          ],
        }),
        this.vagaApplicationsRepository.count({
          where: { submittedByHunterId: hunterId, isRejected: false },
        }),
        this.hunterInterestsRepository.count({
          where: { hunterUserId: hunterId, status: HunterInterestStatus.PENDING },
        }),
      ]);

    return {
      ganhosNoMes: parseFloat(ganhosRow?.sum ?? '0'),
      placementsEmAndamento,
      candidatosEmProcessosAtivos,
      indicacoesAguardandoResposta,
    };
  }

  /** `GET /stats/hunter/ganhos` — 4 cards de `/app/hunter/ganhos` (T-H09). */
  async hunterGanhos(hunterId: string): Promise<HunterGanhosStats> {
    const yearStart = startOfYear();
    const now = new Date();

    const [aReceberRow, recebidoRow, placementsConfirmados, emGarantia] = await Promise.all([
      this.placementsRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.hunterShareAmount), 0)', 'sum')
        .where('p.hunterId = :hunterId', { hunterId })
        .andWhere('p.status = :status', { status: PlacementStatus.CONFIRMED })
        .getRawOne<{ sum: string }>(),
      this.placementsRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.hunterShareAmount), 0)', 'sum')
        .where('p.hunterId = :hunterId', { hunterId })
        .andWhere('p.status = :status', { status: PlacementStatus.FEE_RELEASED })
        .andWhere('p.feeReleasedAt >= :yearStart', { yearStart })
        .getRawOne<{ sum: string }>(),
      this.placementsRepository.count({
        where: [
          { hunterId, status: PlacementStatus.CONFIRMED },
          { hunterId, status: PlacementStatus.FEE_RELEASED },
        ],
      }),
      this.placementsRepository
        .createQueryBuilder('p')
        .where('p.hunterId = :hunterId', { hunterId })
        .andWhere('p.status = :status', { status: PlacementStatus.CONFIRMED })
        .andWhere('p.guaranteeEndsAt > :now', { now })
        .getCount(),
    ]);

    return {
      aReceber: parseFloat(aReceberRow?.sum ?? '0'),
      recebidoNoAno: parseFloat(recebidoRow?.sum ?? '0'),
      placementsConfirmados,
      emGarantia,
    };
  }

  // ── Empresa ──────────────────────────────────────────────────────────────

  /** `GET /stats/empresa` — 4 cards do workspace Empresa (§05). Só contas `isCompany`. */
  async empresaDashboard(actorId: string): Promise<EmpresaDashboardStats> {
    const actor = await this.usersRepository.findOne({ where: { id: actorId } });
    if (!actor || !actor.isCompany) {
      throw new ForbiddenException(
        'Este painel é exclusivo de contas empresa.',
      );
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const yearStart = startOfYear();

    const vagaIdsSubquery = this.vagasRepository
      .createQueryBuilder('v')
      .select('v.id')
      .where('v.createdById = :actorId', { actorId });

    const [vagasAbertas, candidatosNovos7d, huntersTrabalhando, contratacoesNoAno] =
      await Promise.all([
        this.vagasRepository.count({
          where: { createdById: actorId, status: VagaStatus.PUBLISHED },
        }),
        this.vagaApplicationsRepository
          .createQueryBuilder('app')
          .where(`app.vagaId IN (${vagaIdsSubquery.getQuery()})`)
          .setParameters(vagaIdsSubquery.getParameters())
          .andWhere('app.createdAt >= :sevenDaysAgo', { sevenDaysAgo })
          .getCount(),
        this.hunterInterestsRepository
          .createQueryBuilder('hi')
          .select('COUNT(DISTINCT hi.hunterUserId)', 'count')
          .where(`hi.vagaId IN (${vagaIdsSubquery.getQuery()})`)
          .setParameters(vagaIdsSubquery.getParameters())
          .andWhere('hi.status = :status', { status: HunterInterestStatus.ACCEPTED })
          .getRawOne<{ count: string }>(),
        this.placementsRepository
          .createQueryBuilder('p')
          .where(`p.vagaId IN (${vagaIdsSubquery.getQuery()})`)
          .setParameters(vagaIdsSubquery.getParameters())
          .andWhere('p.confirmedAt >= :yearStart', { yearStart })
          .getCount(),
      ]);

    return {
      vagasAbertas,
      candidatosNovos7d,
      huntersTrabalhando: parseInt(huntersTrabalhando?.count ?? '0', 10),
      contratacoesNoAno,
    };
  }

  // ── Candidato (T-C02) ─────────────────────────────────────────────────────

  /** Cards do topo de `/app/candidato` (T-C02). */
  async candidatoDashboard(userId: string): Promise<CandidatoDashboardStats> {
    const [candidaturasAtivas, vagasSalvas] = await Promise.all([
      this.vagaApplicationsRepository.count({
        where: { userId, isRejected: false },
      }),
      this.savedVagasRepository.count({ where: { userId } }),
    ]);

    return { candidaturasAtivas, vagasSalvas, visualizacoesPerfil7d: null };
  }

  // ── Consultoria (time de hunters) ────────────────────────────────────────

  /** Resolve os IDs de vaga geridos pelo time (ou só pelo próprio ator, se não tiver time). */
  private async resolveManagedVagaIds(actorId: string): Promise<{
    vagaIdsSubquery: SelectQueryBuilder<Vaga>;
    teamUserIds: string[];
  }> {
    const team = await this.teamContextHelper.getTeamForUser(actorId);
    if (!team) {
      throw new BadRequestException(
        'Este painel é para times (plano TEAM/ENTERPRISE) — sua conta ainda não tem um time.',
      );
    }
    const teamUserIds = await this.teamContextHelper.getTeamUserIds(team.ownerId);

    const vagaIdsSubquery = this.vagasRepository
      .createQueryBuilder('v')
      .select('v.id')
      .where('v.createdById IN (:...teamUserIds)', { teamUserIds });

    return { vagaIdsSubquery, teamUserIds };
  }

  /** `GET /stats/consultoria` — 5 KPIs + pipeline overview + feed de atividade (§04). */
  async consultoriaDashboard(actorId: string): Promise<ConsultoriaDashboardStats> {
    const { vagaIdsSubquery, teamUserIds } = await this.resolveManagedVagaIds(actorId);
    const monthStart = startOfMonth();

    const [vagasAtivas, candidatosEmProcesso, placementsNoMes, receitaRow, pipelineRaw, atividadeRaw] =
      await Promise.all([
        this.vagasRepository
          .createQueryBuilder('v')
          .where('v.createdById IN (:...teamUserIds)', { teamUserIds })
          .andWhere('v.status = :status', { status: VagaStatus.PUBLISHED })
          .getCount(),
        this.vagaApplicationsRepository
          .createQueryBuilder('app')
          .where(`app.vagaId IN (${vagaIdsSubquery.getQuery()})`)
          .setParameters(vagaIdsSubquery.getParameters())
          .andWhere('app.isRejected = false')
          .getCount(),
        this.placementsRepository
          .createQueryBuilder('p')
          .where('p.hunterId IN (:...teamUserIds)', { teamUserIds })
          .andWhere('p.confirmedAt >= :monthStart', { monthStart })
          .getCount(),
        this.placementsRepository
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.hunterShareAmount), 0)', 'sum')
          .where('p.hunterId IN (:...teamUserIds)', { teamUserIds })
          .andWhere('p.confirmedAt >= :monthStart', { monthStart })
          .getRawOne<{ sum: string }>(),
        this.vagaApplicationsRepository
          .createQueryBuilder('app')
          .select('app.pipelineStage', 'stage')
          .addSelect('COUNT(*)', 'count')
          .where(`app.vagaId IN (${vagaIdsSubquery.getQuery()})`)
          .setParameters(vagaIdsSubquery.getParameters())
          .andWhere('app.isRejected = false')
          .groupBy('app.pipelineStage')
          .getRawMany<{ stage: string; count: string }>(),
        this.vagaApplicationsRepository
          .createQueryBuilder('app')
          .select(['app.id', 'app.vagaId', 'app.stageHistory'])
          .where(`app.vagaId IN (${vagaIdsSubquery.getQuery()})`)
          .setParameters(vagaIdsSubquery.getParameters())
          .andWhere("app.stageHistory != '[]'::jsonb")
          .orderBy('app.updatedAt', 'DESC')
          .limit(20)
          .getMany(),
      ]);

    const pipelineOverview: PipelineOverviewEntry[] = pipelineRaw.map((r) => ({
      stage: r.stage,
      count: parseInt(r.count, 10),
    }));

    const atividadeRecente: ActivityFeedEntry[] = atividadeRaw
      .flatMap((app) =>
        app.stageHistory.map((h) => ({
          vagaId: app.vagaId,
          applicationId: app.id,
          stage: h.stage,
          enteredAt: h.enteredAt,
          byUserId: h.byUserId,
        })),
      )
      .sort((a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime())
      .slice(0, 20);

    return {
      vagasAtivas,
      candidatosEmProcesso,
      placementsNoMes,
      receitaDoMes: parseFloat(receitaRow?.sum ?? '0'),
      pipelineOverview,
      atividadeRecente,
    };
  }

  /** `GET /stats/consultoria/ganhos` — "Placements & Ganhos" do time. */
  async consultoriaGanhos(actorId: string): Promise<ConsultoriaGanhosStats> {
    const { teamUserIds } = await this.resolveManagedVagaIds(actorId);
    const yearStart = startOfYear();

    const [aReceberRow, recebidoRow, placementsRow] = await Promise.all([
      this.placementsRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.hunterShareAmount), 0)', 'sum')
        .where('p.hunterId IN (:...teamUserIds)', { teamUserIds })
        .andWhere('p.status = :status', { status: PlacementStatus.CONFIRMED })
        .getRawOne<{ sum: string }>(),
      this.placementsRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.hunterShareAmount), 0)', 'sum')
        .where('p.hunterId IN (:...teamUserIds)', { teamUserIds })
        .andWhere('p.status = :status', { status: PlacementStatus.FEE_RELEASED })
        .andWhere('p.feeReleasedAt >= :yearStart', { yearStart })
        .getRawOne<{ sum: string }>(),
      this.placementsRepository
        .createQueryBuilder('p')
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(AVG(p.feeAmount), 0)', 'avgFee')
        .where('p.hunterId IN (:...teamUserIds)', { teamUserIds })
        .andWhere('p.status IN (:...statuses)', {
          statuses: [PlacementStatus.CONFIRMED, PlacementStatus.FEE_RELEASED],
        })
        .getRawOne<{ count: string; avgFee: string }>(),
    ]);

    const placements = parseInt(placementsRow?.count ?? '0', 10);

    return {
      aReceber: parseFloat(aReceberRow?.sum ?? '0'),
      recebidoNoAno: parseFloat(recebidoRow?.sum ?? '0'),
      placements,
      ticketMedioFee: placements > 0 ? parseFloat(placementsRow?.avgFee ?? '0') : null,
    };
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  /** `GET /admin/stats` — painel admin (§06). Churn e gráfico 12m ficam fora de escopo (sem série histórica). */
  async adminDashboard(): Promise<AdminDashboardStats> {
    const monthStart = startOfMonth();
    const now = new Date();

    const [
      gmvRow,
      placementsMes,
      huntersVerificados,
      vagasAtivas,
      activeUsers,
      disputasAbertas,
      verificacoesPendentes,
      cuponsAValidar,
    ] = await Promise.all([
      this.placementsRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.feeAmount), 0)', 'gmv')
        .addSelect('COALESCE(SUM(p.platformShareAmount), 0)', 'take')
        .where('p.confirmedAt >= :monthStart', { monthStart })
        .getRawOne<{ gmv: string; take: string }>(),
      this.placementsRepository
        .createQueryBuilder('p')
        .where('p.confirmedAt >= :monthStart', { monthStart })
        .getCount(),
      this.usersRepository.count({
        where: { verificationStatus: HunterVerificationStatus.APPROVED },
      }),
      this.vagasRepository.count({ where: { status: VagaStatus.PUBLISHED } }),
      this.usersRepository.find({
        where: { planStatus: PlanStatus.ACTIVE },
        select: ['id', 'plan', 'planExpiresAt'],
      }),
      this.placementsRepository.count({ where: { status: PlacementStatus.DISPUTED } }),
      this.usersRepository.count({
        where: { verificationStatus: HunterVerificationStatus.PENDING },
      }),
      this.couponRedemptionsRepository.count({
        where: { status: RedemptionStatus.PENDING_VALIDATION },
      }),
    ]);

    const mrr = activeUsers
      .filter((u) => u.planExpiresAt !== null && u.planExpiresAt > now)
      .reduce((sum, u) => sum + (PLAN_PRICES_BRL[u.plan] ?? 0), 0);

    return {
      gmvMes: parseFloat(gmvRow?.gmv ?? '0'),
      takePlataformaMes: parseFloat(gmvRow?.take ?? '0'),
      placementsMes,
      huntersVerificados,
      vagasAtivas,
      mrr,
      disputasAbertas,
      verificacoesPendentes,
      cuponsAValidar,
    };
  }
}
