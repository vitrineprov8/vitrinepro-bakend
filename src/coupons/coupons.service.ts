import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Coupon, DiscountType } from './coupon.entity';
import { CouponRedemption, RedemptionStatus } from './coupon-redemption.entity';
import { User, PlanTier, PlanStatus } from '../users/user.entity';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuditAction } from '../admin-audit-log/admin-audit-log.entity';
import { CreateCouponCampaignDto } from './dto/create-coupon-campaign.dto';
import { UpdateCouponCampaignDto } from './dto/update-coupon-campaign.dto';
import { paginate, PaginatedResult } from '../common/paginate.helper';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponsRepository: Repository<Coupon>,
    @InjectRepository(CouponRedemption)
    private redemptionsRepository: Repository<CouponRedemption>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private adminAuditLogService: AdminAuditLogService,
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
   * Conta/Indicações (M4) — lista as redenções do cupom de referral do
   * PRÓPRIO usuário (quem usou, quando, status), com e-mail mascarado
   * (mesmo padrão de mascaramento já usado em RN-NOVA-03). Diferente de
   * `listPendingRedemptions()` (admin, global, sem masking porque é uso
   * interno). Cria o cupom on-demand (mesmo comportamento de `getOrCreateForUser`)
   * pra uma conta nova nunca ver 404 aqui.
   */
  async listMyRedemptions(userId: string): Promise<{
    coupon: { code: string; discountValue: number };
    totalDiasGanhos: number;
    redemptions: Array<{ id: string; indicadoMasked: string; createdAt: Date; status: RedemptionStatus }>;
  }> {
    const coupon = await this.getOrCreateForUser(userId);

    const rows = await this.redemptionsRepository
      .createQueryBuilder('redemption')
      .leftJoin('redemption.redeemedBy', 'redeemedBy')
      .addSelect(['redeemedBy.email'])
      .where('redemption.couponId = :couponId', { couponId: coupon.id })
      .orderBy('redemption.createdAt', 'DESC')
      .getMany();

    const mask = (email?: string | null) => {
      if (!email) return '—';
      const [user, domain] = email.split('@');
      if (!domain) return email;
      return `${user.slice(0, 2)}${'•'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
    };

    const totalDiasGanhos = rows.filter(r => r.bonusGranted).length * 30;

    return {
      coupon: { code: coupon.code, discountValue: coupon.discountValue },
      totalDiasGanhos,
      redemptions: rows.map(r => ({
        id: r.id,
        indicadoMasked: mask(r.redeemedBy?.email),
        createdAt: r.createdAt,
        status: r.status,
      })),
    };
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
      select: [
        'id', 'code', 'ownerId', 'discountType', 'discountValue', 'isActive',
        'validFrom', 'validUntil', 'usageLimit', 'usageCount',
      ],
    });

    if (!coupon || !coupon.isActive) {
      return { valid: false };
    }

    // A5 — cupons de campanha podem ter janela de validade e limite de usos
    // (cupons de referral não usam esses campos, ficam null = sem restrição).
    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) return { valid: false };
    if (coupon.validUntil && coupon.validUntil < now) return { valid: false };
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
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

    const saved = await this.redemptionsRepository.save(redemption);

    // A5 — conta o uso pra respeitar `usageLimit` de cupons de campanha
    // (incrementa mesmo pra cupons de referral, que simplesmente não têm
    // limite configurado — inofensivo, só não é usado pra nada nesse caso).
    await this.couponsRepository.increment({ id: couponId }, 'usageCount', 1);

    return saved;
  }

  /**
   * Lists all pending redemptions with related data for admin review.
   *
   * Bug de segurança encontrado e corrigido nesta rodada (A5 — ao construir
   * a tela de admin que consome este endpoint): a versão anterior usava
   * `find({relations: ['coupon.owner', 'redeemedBy']})`, que carrega a
   * entidade `User` INTEIRA nas relações — incluindo o hash de `password` —
   * mesma classe de bug já documentada em B19/F7 (endpoints que vazavam
   * senha via relation crua). Trocado por `createQueryBuilder` com
   * `addSelect` restrito às colunas que a UI realmente usa.
   */
  async listPendingRedemptions(): Promise<CouponRedemption[]> {
    return this.redemptionsRepository
      .createQueryBuilder('redemption')
      .leftJoin('redemption.coupon', 'coupon')
      .leftJoin('coupon.owner', 'owner')
      .leftJoin('redemption.redeemedBy', 'redeemedBy')
      .addSelect(['coupon.id', 'coupon.code', 'coupon.discountType', 'coupon.discountValue'])
      .addSelect(['owner.id', 'owner.firstName', 'owner.lastName', 'owner.email'])
      .addSelect(['redeemedBy.id', 'redeemedBy.firstName', 'redeemedBy.lastName', 'redeemedBy.email'])
      .where('redemption.status = :status', { status: RedemptionStatus.PENDING_VALIDATION })
      .orderBy('redemption.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Validates a redemption: marks VALIDATED, grants +30 days to coupon owner.
   * If owner has no active plan, activates RECRUITER as minimum gift.
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
        // No active plan — gift 30 days starting now, minimum RECRUITER
        owner.planStatus = PlanStatus.ACTIVE;
        if (owner.plan === PlanTier.FREE) {
          owner.plan = PlanTier.RECRUITER;
        }
        owner.planExpiresAt = new Date(now.getTime() + thirtyDays);
      }

      await this.usersRepository.save(owner);
    }

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.COUPON_REDEMPTION_VALIDATE,
      targetType: 'CouponRedemption',
      targetId: redemption.id,
      payloadBefore: { status: RedemptionStatus.PENDING_VALIDATION },
      payloadAfter: { status: redemption.status, bonusGranted: redemption.bonusGranted },
    });

    return redemption;
  }

  /**
   * Returns all active promotional coupons that are not owned by any user
   * (i.e. admin-created campaigns). Only exposes code, discountType and
   * discountValue — no ownership or redemption data is leaked.
   */
  async listPublicActive(): Promise<
    Array<{ code: string; discountType: DiscountType; discountValue: number }>
  > {
    const coupons = await this.couponsRepository.find({
      where: { isActive: true, ownerId: IsNull() },
      select: ['code', 'discountType', 'discountValue'],
      order: { createdAt: 'ASC' },
    });

    return coupons.map(({ code, discountType, discountValue }) => ({
      code,
      discountType,
      discountValue,
    }));
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

    const saved = await this.redemptionsRepository.save(redemption);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.COUPON_REDEMPTION_REJECT,
      targetType: 'CouponRedemption',
      targetId: saved.id,
      payloadBefore: { status: RedemptionStatus.PENDING_VALIDATION },
      payloadAfter: { status: saved.status },
    });

    return saved;
  }

  // ---------------------------------------------------------------------
  // A5 — Cupons de campanha (CRUD admin). Diferem do cupom de referral por
  // `ownerId IS NULL` — mesma tabela, sem entidade separada, pra reusar
  // `validate()`/`listPublicActive()` sem duplicar lógica.
  // ---------------------------------------------------------------------

  /** GET /admin/coupons/campaigns — lista paginada, mais recentes primeiro. */
  async listCampaigns(page = 1, limit = 20): Promise<PaginatedResult<Coupon>> {
    const qb = this.couponsRepository
      .createQueryBuilder('coupon')
      .where('coupon.ownerId IS NULL')
      .orderBy('coupon.createdAt', 'DESC');
    return paginate(qb, page, limit);
  }

  private async assertCodeAvailable(code: string, excludeId?: string): Promise<void> {
    const existing = await this.couponsRepository.findOne({
      where: excludeId ? { code, id: Not(excludeId) } : { code },
    });
    if (existing) {
      throw new ConflictException('Já existe um cupom com este código.');
    }
  }

  /** POST /admin/coupons/campaigns — cria um cupom de campanha (ownerId null). */
  async createCampaign(dto: CreateCouponCampaignDto, adminId: string): Promise<Coupon> {
    const code = dto.code.toUpperCase();
    await this.assertCodeAvailable(code);

    if (dto.validFrom && dto.validUntil && new Date(dto.validFrom) > new Date(dto.validUntil)) {
      throw new BadRequestException('A data de início não pode ser depois da data de término.');
    }

    const coupon = this.couponsRepository.create({
      code,
      ownerId: null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      isActive: true,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      usageLimit: dto.usageLimit ?? null,
      usageCount: 0,
    });
    const saved = await this.couponsRepository.save(coupon);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.COUPON_CAMPAIGN_CREATE,
      targetType: 'Coupon',
      targetId: saved.id,
      payloadAfter: { code: saved.code, discountType: saved.discountType, discountValue: saved.discountValue },
    });

    return saved;
  }

  /** PATCH /admin/coupons/campaigns/:id — edita um cupom de campanha existente. */
  async updateCampaign(
    id: string,
    dto: UpdateCouponCampaignDto,
    adminId: string,
  ): Promise<Coupon> {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupom não encontrado.');
    if (coupon.ownerId) {
      throw new BadRequestException('Este cupom é um cupom de referral — não pode ser editado por aqui.');
    }

    const before = {
      code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue,
      validFrom: coupon.validFrom, validUntil: coupon.validUntil, usageLimit: coupon.usageLimit,
    };

    if (dto.code) {
      const newCode = dto.code.toUpperCase();
      if (newCode !== coupon.code) await this.assertCodeAvailable(newCode, id);
      coupon.code = newCode;
    }
    if (dto.discountType) coupon.discountType = dto.discountType;
    if (dto.discountValue != null) coupon.discountValue = dto.discountValue;
    if (dto.validFrom !== undefined) coupon.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined) coupon.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.usageLimit !== undefined) coupon.usageLimit = dto.usageLimit ?? null;

    if (coupon.validFrom && coupon.validUntil && coupon.validFrom > coupon.validUntil) {
      throw new BadRequestException('A data de início não pode ser depois da data de término.');
    }

    const saved = await this.couponsRepository.save(coupon);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.COUPON_CAMPAIGN_UPDATE,
      targetType: 'Coupon',
      targetId: saved.id,
      payloadBefore: before,
      payloadAfter: {
        code: saved.code, discountType: saved.discountType, discountValue: saved.discountValue,
        validFrom: saved.validFrom, validUntil: saved.validUntil, usageLimit: saved.usageLimit,
      },
    });

    return saved;
  }

  /** POST /admin/coupons/campaigns/:id/toggle — ativa/desativa o cupom. */
  async toggleCampaign(id: string, adminId: string): Promise<Coupon> {
    const coupon = await this.couponsRepository.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupom não encontrado.');
    if (coupon.ownerId) {
      throw new BadRequestException('Este cupom é um cupom de referral — não pode ser alterado por aqui.');
    }

    const before = coupon.isActive;
    coupon.isActive = !coupon.isActive;
    const saved = await this.couponsRepository.save(coupon);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.COUPON_CAMPAIGN_TOGGLE,
      targetType: 'Coupon',
      targetId: saved.id,
      payloadBefore: { isActive: before },
      payloadAfter: { isActive: saved.isActive },
    });

    return saved;
  }
}
