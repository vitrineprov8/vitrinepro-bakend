import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, DiscountType } from './coupon.entity';
import { CouponRedemption, RedemptionStatus } from './coupon-redemption.entity';
import { User, PlanTier, PlanStatus } from '../users/user.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponsRepository: Repository<Coupon>,
    @InjectRepository(CouponRedemption)
    private redemptionsRepository: Repository<CouponRedemption>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Returns the user's referral coupon.
   * Creates one on demand if it does not yet exist, using the user's referralCode.
   */
  async getOrCreateForUser(userId: string): Promise<Coupon> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Check if coupon already exists
    const existing = await this.couponsRepository.findOne({
      where: { ownerId: userId },
    });
    if (existing) return existing;

    // Use referralCode as the coupon code
    if (!user.referralCode) {
      throw new NotFoundException(
        'Código de indicação não encontrado. Contate o suporte.',
      );
    }

    const coupon = this.couponsRepository.create({
      code: user.referralCode,
      ownerId: userId,
      discountType: DiscountType.PERCENT,
      discountValue: 10, // 10% default referral discount
      isActive: true,
    });

    return this.couponsRepository.save(coupon);
  }

  /**
   * Validates a coupon code for checkout use.
   * Returns coupon details if valid; throws NotFoundException if not found or inactive.
   * Prevents self-use when requestingUserId is provided.
   */
  async validate(
    code: string,
    requestingUserId?: string,
  ): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discountType?: DiscountType;
    discountValue?: number;
    ownerId?: string | null;
  }> {
    const coupon = await this.couponsRepository.findOne({
      where: { code },
      select: ['id', 'code', 'ownerId', 'discountType', 'discountValue', 'isActive'],
    });

    if (!coupon || !coupon.isActive) {
      return { valid: false };
    }

    // Prevent self-use of own referral coupon
    if (requestingUserId && coupon.ownerId === requestingUserId) {
      return { valid: false };
    }

    return {
      valid: true,
      coupon,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      ownerId: coupon.ownerId,
    };
  }

  /**
   * Creates a CouponRedemption record in PENDING_VALIDATION state.
   * Throws ConflictException if the user already redeemed this coupon.
   */
  async createRedemption(
    couponId: string,
    redeemedById: string,
    subscriptionId: string,
  ): Promise<CouponRedemption> {
    const existing = await this.redemptionsRepository.findOne({
      where: { couponId, redeemedById },
    });
    if (existing) {
      throw new ConflictException('Você já utilizou este cupom.');
    }

    const redemption = this.redemptionsRepository.create({
      couponId,
      redeemedById,
      subscriptionId,
      status: RedemptionStatus.PENDING_VALIDATION,
      bonusGranted: false,
    });

    return this.redemptionsRepository.save(redemption);
  }

  /** Lists all pending redemptions with related data for admin review */
  async listPendingRedemptions(): Promise<CouponRedemption[]> {
    return this.redemptionsRepository.find({
      where: { status: RedemptionStatus.PENDING_VALIDATION },
      relations: ['coupon', 'coupon.owner', 'redeemedBy'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Validates a redemption: marks VALIDATED, grants +30 days to coupon owner.
   * If owner has no active plan, activates PERSONAL as minimum gift.
   */
  async validateRedemption(
    redemptionId: string,
    adminId: string,
  ): Promise<CouponRedemption> {
    const redemption = await this.redemptionsRepository.findOne({
      where: { id: redemptionId },
      relations: ['coupon', 'coupon.owner'],
    });

    if (!redemption) throw new NotFoundException('Redenção não encontrada.');
    if (redemption.status !== RedemptionStatus.PENDING_VALIDATION) {
      throw new ConflictException('Esta redenção já foi processada.');
    }

    const now = new Date();

    redemption.status = RedemptionStatus.VALIDATED;
    redemption.validatedAt = now;
    redemption.validatedById = adminId;
    redemption.bonusGranted = true;

    await this.redemptionsRepository.save(redemption);

    // Grant +30 days to coupon owner
    const owner = redemption.coupon?.owner;
    if (owner) {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      if (owner.planStatus === PlanStatus.ACTIVE && owner.planExpiresAt && owner.planExpiresAt > now) {
        // Extend from current expiry
        owner.planExpiresAt = new Date(owner.planExpiresAt.getTime() + thirtyDays);
      } else {
        // No active plan — gift 30 days starting now, minimum PERSONAL
        owner.planStatus = PlanStatus.ACTIVE;
        if (owner.plan === PlanTier.FREE) {
          owner.plan = PlanTier.PERSONAL;
        }
        owner.planExpiresAt = new Date(now.getTime() + thirtyDays);
      }

      await this.usersRepository.save(owner);
    }

    return redemption;
  }

  /** Rejects a redemption — no bonus granted */
  async rejectRedemption(
    redemptionId: string,
    adminId: string,
  ): Promise<CouponRedemption> {
    const redemption = await this.redemptionsRepository.findOne({
      where: { id: redemptionId },
    });

    if (!redemption) throw new NotFoundException('Redenção não encontrada.');
    if (redemption.status !== RedemptionStatus.PENDING_VALIDATION) {
      throw new ConflictException('Esta redenção já foi processada.');
    }

    redemption.status = RedemptionStatus.REJECTED;
    redemption.validatedAt = new Date();
    redemption.validatedById = adminId;

    return this.redemptionsRepository.save(redemption);
  }
}
