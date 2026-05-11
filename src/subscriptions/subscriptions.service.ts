import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { User, PlanTier, PlanStatus } from '../users/user.entity';
import { CouponsService } from '../coupons/coupons.service';
import { DiscountType } from '../coupons/coupon.entity';
import { PLAN_PRICES_BRL } from '../plans/plan-limits';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private couponsService: CouponsService,
  ) {}

  async listByUser(userId: string): Promise<Subscription[]> {
    return this.subscriptionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async checkout(
    userId: string,
    dto: CheckoutDto,
  ): Promise<{
    subscriptionId: string;
    priceBRL: number;
    discountBRL: number;
    totalBRL: number;
    couponValid: boolean;
    couponId?: string;
  }> {
    if (dto.plan === PlanTier.FREE) {
      throw new BadRequestException(
        'O plano Gratuito não pode ser assinado. Escolha um plano pago.',
      );
    }

    const priceBRL = PLAN_PRICES_BRL[dto.plan];
    let discountBRL = 0;
    let couponValid = false;
    let couponId: string | undefined;
    let couponCode: string | null = null;

    // Validate coupon if provided
    if (dto.couponCode) {
      const validation = await this.couponsService.validate(
        dto.couponCode,
        userId,
      );

      if (validation.valid && validation.coupon) {
        couponValid = true;
        couponId = validation.coupon.id;
        couponCode = dto.couponCode;

        if (validation.discountType === DiscountType.PERCENT) {
          discountBRL = Math.round((priceBRL * (validation.discountValue ?? 0)) / 100 * 100) / 100;
        } else {
          discountBRL = Math.min(validation.discountValue ?? 0, priceBRL);
        }
      }
    }

    const totalBRL = Math.max(0, priceBRL - discountBRL);

    const subscription = this.subscriptionsRepository.create({
      userId,
      plan: dto.plan,
      status: SubscriptionStatus.PENDING,
      priceBRL,
      couponCode,
      discountApplied: discountBRL,
    });

    const saved = await this.subscriptionsRepository.save(subscription);

    return {
      subscriptionId: saved.id,
      priceBRL,
      discountBRL,
      totalBRL,
      couponValid,
      ...(couponId ? { couponId } : {}),
    };
  }

  /**
   * MOCK confirmation — in production this will be replaced by a payment gateway webhook.
   * Marks the subscription ACTIVE, updates user plan/status/expiry.
   * If a coupon was used, creates a CouponRedemption for admin validation.
   */
  async confirm(
    subscriptionId: string,
    userId: string,
  ): Promise<{
    plan: PlanTier;
    planStatus: PlanStatus;
    planExpiresAt: Date;
    subscriptionId: string;
  }> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada.');
    }

    if (subscription.userId !== userId) {
      throw new ForbiddenException('Acesso não autorizado a esta assinatura.');
    }

    if (subscription.status !== SubscriptionStatus.PENDING) {
      throw new BadRequestException('Esta assinatura já foi processada.');
    }

    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    // Mark subscription active
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.startsAt = now;
    subscription.endsAt = new Date(now.getTime() + thirtyDays);

    await this.subscriptionsRepository.save(subscription);

    // Update user plan — extend if already active, else set fresh
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const currentExpiry = user.planExpiresAt;
    const isCurrentlyActive =
      user.planStatus === PlanStatus.ACTIVE &&
      currentExpiry !== null &&
      currentExpiry > now;

    const newExpiry = isCurrentlyActive
      ? new Date(currentExpiry.getTime() + thirtyDays)
      : subscription.endsAt;

    user.plan = subscription.plan;
    user.planStatus = PlanStatus.ACTIVE;
    user.planExpiresAt = newExpiry;

    await this.usersRepository.save(user);

    // If coupon was used, create a redemption for admin validation
    if (subscription.couponCode) {
      const validation = await this.couponsService.validate(
        subscription.couponCode,
        userId,
      );
      if (validation.valid && validation.coupon) {
        try {
          await this.couponsService.createRedemption(
            validation.coupon.id,
            userId,
            subscriptionId,
          );
        } catch {
          // Silently ignore duplicate — user may have already redeemed this coupon
        }
      }
    }

    return {
      plan: user.plan,
      planStatus: user.planStatus,
      planExpiresAt: newExpiry,
      subscriptionId: subscription.id,
    };
  }
}
