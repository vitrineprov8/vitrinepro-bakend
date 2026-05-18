import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { User, PlanTier, PlanStatus } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { PLAN_VAGA_LIMITS } from '../plans/plan-limits';
import { VagaPublishLedger } from './vaga-publish-ledger.entity';
import { getCurrentCycle, BillingCycle } from './cycle.util';
import { TeamContextHelper } from '../teams/team-context.helper';
import { TeamRole } from '../teams/team-member.entity';

export interface VagaUsageSummary {
  used: number;
  limit: number;
  cycleStart: Date;
  cycleEnd: Date;
  planTier: PlanTier;
  /**
   * Present and true when the usage is reported against the team owner's
   * quota rather than the user's own.  The frontend can use this to
   * display a "Cota do time" badge.
   */
  inheritedFromTeam?: boolean;
}

@Injectable()
export class VagaPublishLedgerService {
  private readonly logger = new Logger(VagaPublishLedgerService.name);

  constructor(
    @InjectRepository(VagaPublishLedger)
    private ledgerRepository: Repository<VagaPublishLedger>,
    private teamContextHelper: TeamContextHelper,
  ) {}

  /**
   * Counts how many publish slots have been used by the user in the current
   * billing cycle.  Uses a straightforward COUNT — the unique index on
   * (userId, vagaId, cycleStart) ensures no double counting.
   *
   * `userId` here should always be the QUOTA OWNER's id (not the caller's id
   * when the caller is a team member).
   */
  async countUsedThisCycle(user: User): Promise<number> {
    const cycle = getCurrentCycle(user);
    return this.ledgerRepository
      .createQueryBuilder('ledger')
      .where('ledger."userId" = :userId', { userId: user.id })
      .andWhere('ledger."cycleStart" = :cycleStart', {
        cycleStart: cycle.start,
      })
      .getCount();
  }

  /**
   * Records a publish event in the ledger.
   *
   * Uses INSERT ... ON CONFLICT DO NOTHING so that re-publishing the same vaga
   * in the same cycle is silently ignored (idempotent).  The caller should
   * still check the limit *before* calling this method.
   *
   * Accepts an optional QueryRunner to participate in a caller-managed
   * transaction (recommended for atomicity with vaga.status update).
   */
  async recordPublish(
    user: User,
    vaga: Vaga,
    cycle: BillingCycle,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(VagaPublishLedger)
      : this.ledgerRepository;

    await repo
      .createQueryBuilder()
      .insert()
      .into(VagaPublishLedger)
      .values({
        userId: user.id,
        vagaId: vaga.id,
        cycleStart: cycle.start,
        cycleEnd: cycle.end,
      })
      .orIgnore() // ON CONFLICT DO NOTHING — idempotent for same vaga/cycle
      .execute();
  }

  /**
   * Returns a usage summary for the current billing cycle, suitable for the
   * GET /vagas/me/usage endpoint.
   *
   * When the caller is a MANAGER or RECRUITER (ACTIVE team member), the usage
   * and limit are reported against the TEAM OWNER's quota — the same quota
   * that publish() charges against.
   */
  async getUsage(user: User): Promise<VagaUsageSummary> {
    const ctx = await this.teamContextHelper.getTeamContext(user);
    const isTeamMember = ctx.team !== null && ctx.role !== TeamRole.OWNER;

    // The owner (quota holder) whose plan and ledger we read
    const quotaOwner = ctx.quotaOwner;

    const now = new Date();
    const isSubscriptionActive =
      quotaOwner.planStatus === PlanStatus.ACTIVE &&
      quotaOwner.planExpiresAt !== null &&
      quotaOwner.planExpiresAt > now;

    const effectivePlan: PlanTier = isSubscriptionActive
      ? quotaOwner.plan
      : PlanTier.FREE;

    const cycle = getCurrentCycle(quotaOwner);
    const used = await this.countUsedThisCycle(quotaOwner);
    const limit = PLAN_VAGA_LIMITS[effectivePlan];

    return {
      used,
      limit,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      planTier: effectivePlan,
      ...(isTeamMember ? { inheritedFromTeam: true } : {}),
    };
  }
}
