import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, PlanTier, PlanStatus } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { TeamContextHelper } from '../teams/team-context.helper';
import { TeamRole } from '../teams/team-member.entity';
import {
  PLAN_FEATURES,
  PLAN_NAMES,
  PLAN_PRICES_BRL,
  PLAN_SEAT_LIMITS,
  PLAN_VAGA_LIMITS,
} from './plan-limits';

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  priceBRL: number;
  vagaLimit: number;
  seatLimit: number;
  features: string[];
}

export interface MyPlanInfo {
  plan: PlanTier;
  planStatus: PlanStatus;
  planExpiresAt: Date | null;
  vagasUsed: number;
  vagasLimit: number;
  /**
   * Present and true when the plan shown is inherited from the team owner,
   * not from the user's own subscription.  The frontend can use this to
   * display a contextual badge (e.g. "Plano do time").
   */
  inheritedFromTeam?: boolean;
  /**
   * The role this user plays inside the team.
   * OWNER → the user owns the team.
   * MANAGER | RECRUITER → the user is an active member inheriting the owner's plan.
   * null → solo user with no team affiliation.
   */
  teamRole?: TeamRole | null;
  /**
   * The id of the team the user belongs to (as OWNER or ACTIVE member).
   * null when the user has no team context.
   */
  teamId?: string | null;
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    private teamContextHelper: TeamContextHelper,
  ) {}

  listPlans(): PlanInfo[] {
    return (Object.values(PlanTier) as PlanTier[]).map((tier) => ({
      tier,
      name: PLAN_NAMES[tier],
      priceBRL: PLAN_PRICES_BRL[tier],
      vagaLimit: PLAN_VAGA_LIMITS[tier],
      seatLimit: PLAN_SEAT_LIMITS[tier],
      features: PLAN_FEATURES[tier],
    }));
  }

  async getMyPlan(userId: string): Promise<MyPlanInfo> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return {
        plan: PlanTier.FREE,
        planStatus: PlanStatus.NONE,
        planExpiresAt: null,
        vagasUsed: 0,
        vagasLimit: 0,
      };
    }

    // Resolve team context — MANAGER/RECRUITER inherit the OWNER's plan
    const ctx = await this.teamContextHelper.getTeamContext(user);
    const isTeamMember =
      ctx.team !== null &&
      ctx.role !== null &&
      ctx.role !== TeamRole.OWNER;

    // The user whose plan and quota we actually display
    const planUser = isTeamMember ? ctx.quotaOwner : user;

    // Determine effective plan (expired subscription → FREE)
    const now = new Date();
    const isSubscriptionActive =
      planUser.planStatus === PlanStatus.ACTIVE &&
      planUser.planExpiresAt !== null &&
      planUser.planExpiresAt > now;

    const effectivePlan: PlanTier = isSubscriptionActive
      ? planUser.plan
      : PlanTier.FREE;

    // Vaga usage: count all vagas whose creators are in the team
    // (includes owner + all ACTIVE members) so the counter is team-wide.
    let vagasUsed: number;
    if (isTeamMember && ctx.quotaOwner) {
      // Collect all userIds in the owner's team for team-wide count
      const teamUserIds = await this.teamContextHelper.getTeamUserIds(
        ctx.quotaOwner.id,
      );
      vagasUsed = await this.vagasRepository.count({
        where: { createdById: In(teamUserIds) },
      });
    } else {
      // OWNER or solo user — count team-wide (includes members if any)
      const teamUserIds = await this.teamContextHelper.getTeamUserIds(user.id);
      vagasUsed = await this.vagasRepository.count({
        where: { createdById: In(teamUserIds) },
      });
    }

    // Determine teamRole and teamId to expose to the frontend.
    //
    // ctx.role is already set by getTeamContext:
    //   - TeamRole.OWNER   → user owns the team (no membership row needed)
    //   - MANAGER | RECRUITER → user is an ACTIVE member inheriting the plan
    //   - null → solo user, no team
    const teamRole: TeamRole | null = ctx.role ?? null;
    const teamId: string | null = ctx.team?.id ?? null;

    return {
      plan: planUser.plan,
      planStatus: planUser.planStatus,
      planExpiresAt: planUser.planExpiresAt,
      vagasUsed,
      vagasLimit: PLAN_VAGA_LIMITS[effectivePlan],
      ...(isTeamMember ? { inheritedFromTeam: true } : {}),
      teamRole,
      teamId,
    };
  }
}
