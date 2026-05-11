import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, PlanTier, PlanStatus, UserRole } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { PLAN_VAGA_LIMITS } from './plan-limits';

/**
 * Guards POST /vagas by verifying the authenticated user has not reached
 * their plan's vaga limit. Admins bypass this guard entirely.
 *
 * If the plan is expired (planExpiresAt <= now), the user is treated as FREE
 * for limit purposes, which means limit = 0 and they cannot create vagas.
 */
@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;

    // Admins bypass the guard — they can always create vagas
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Fetch fresh user data to get plan status (JWT payload may be stale)
    const freshUser = await this.usersRepository.findOne({
      where: { id: user.id },
      select: ['id', 'plan', 'planStatus', 'planExpiresAt', 'role'],
    });

    if (!freshUser) {
      throw new ForbiddenException('Usuário não encontrado.');
    }

    // Admin check again on fresh data
    if (freshUser.role === UserRole.ADMIN) {
      return true;
    }

    // Determine effective plan tier based on subscription validity
    const now = new Date();
    const isSubscriptionActive =
      freshUser.planStatus === PlanStatus.ACTIVE &&
      freshUser.planExpiresAt !== null &&
      freshUser.planExpiresAt > now;

    const effectivePlan: PlanTier = isSubscriptionActive
      ? freshUser.plan
      : PlanTier.FREE;

    const limit = PLAN_VAGA_LIMITS[effectivePlan];

    // Count how many vagas this user has already created
    const current = await this.vagasRepository.count({
      where: { createdById: user.id },
    });

    if (current >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        current,
        limit,
        plan: effectivePlan,
        message:
          'Você atingiu o limite de vagas do seu plano. Faça upgrade para continuar.',
      });
    }

    return true;
  }
}
