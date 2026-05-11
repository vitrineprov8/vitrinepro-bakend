import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, PlanTier, PlanStatus } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import {
  PLAN_FEATURES,
  PLAN_NAMES,
  PLAN_PRICES_BRL,
  PLAN_VAGA_LIMITS,
} from './plan-limits';

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  priceBRL: number;
  vagaLimit: number;
  features: string[];
}

export interface MyPlanInfo {
  plan: PlanTier;
  planStatus: PlanStatus;
  planExpiresAt: Date | null;
  vagasUsed: number;
  vagasLimit: number;
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
  ) {}

  listPlans(): PlanInfo[] {
    return (Object.values(PlanTier) as PlanTier[]).map((tier) => ({
      tier,
      name: PLAN_NAMES[tier],
      priceBRL: PLAN_PRICES_BRL[tier],
      vagaLimit: PLAN_VAGA_LIMITS[tier],
      features: PLAN_FEATURES[tier],
    }));
  }

  async getMyPlan(userId: string): Promise<MyPlanInfo> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'plan', 'planStatus', 'planExpiresAt'],
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

    const vagasUsed = await this.vagasRepository.count({
      where: { createdById: userId },
    });

    // Determine effective plan — if expired, treat as FREE for limit calculation
    const effectivePlan =
      user.planStatus === PlanStatus.ACTIVE &&
      user.planExpiresAt &&
      user.planExpiresAt > new Date()
        ? user.plan
        : PlanTier.FREE;

    return {
      plan: user.plan,
      planStatus: user.planStatus,
      planExpiresAt: user.planExpiresAt,
      vagasUsed,
      vagasLimit: PLAN_VAGA_LIMITS[effectivePlan],
    };
  }
}
