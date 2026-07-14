import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus, AsaasBillingType } from './subscription.entity';
import { User, PlanTier, PlanStatus } from '../users/user.entity';
import { CouponsService } from '../coupons/coupons.service';
import { DiscountType } from '../coupons/coupon.entity';
import { PLAN_PRICES_BRL, PLAN_NAMES } from '../plans/plan-limits';
import { CheckoutDto } from './dto/checkout.dto';
import { AsaasService } from '../payments/asaas.service';

export interface CheckoutResult {
  subscriptionId: string;
  priceBRL: number;
  discountBRL: number;
  totalBRL: number;
  couponValid: boolean;
  couponId?: string;
  billingType: AsaasBillingType | null;
  status: SubscriptionStatus;
  invoiceUrl?: string;
  pixQrCode?: string; // base64 (encodedImage)
  pixCopyPaste?: string; // payload copia-e-cola
  pixExpirationDate?: string;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private couponsService: CouponsService,
    private asaasService: AsaasService,
  ) {}

  async listByUser(userId: string): Promise<Subscription[]> {
    return this.subscriptionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForUser(id: string, userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionsRepository.findOne({ where: { id } });
    if (!subscription) throw new NotFoundException('Assinatura nao encontrada.');
    if (subscription.userId !== userId) {
      throw new ForbiddenException('Acesso nao autorizado a esta assinatura.');
    }
    return subscription;
  }

  async checkout(
    userId: string,
    dto: CheckoutDto,
    remoteIp?: string,
  ): Promise<CheckoutResult> {
    if (dto.plan === PlanTier.FREE) {
      throw new BadRequestException(
        'O plano Gratuito nao pode ser assinado. Escolha um plano pago.',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado.');

    const priceBRL = PLAN_PRICES_BRL[dto.plan];
    let discountBRL = 0;
    let couponValid = false;
    let couponId: string | undefined;
    let couponCode: string | null = null;

    if (dto.couponCode) {
      const validation = await this.couponsService.validate(dto.couponCode, userId);
      if (validation.valid && validation.coupon) {
        couponValid = true;
        couponId = validation.coupon.id;
        couponCode = dto.couponCode;
        if (validation.discountType === DiscountType.PERCENT) {
          discountBRL =
            Math.round((priceBRL * (validation.discountValue ?? 0)) / 100 * 100) / 100;
        } else {
          discountBRL = Math.min(validation.discountValue ?? 0, priceBRL);
        }
      }
    }

    const totalBRL = Math.max(0, priceBRL - discountBRL);

    // Salva os dados de cobranca no perfil pra reaproveitar em proximas assinaturas.
    user.cpfCnpj = dto.cpfCnpj;
    user.billingPostalCode = dto.postalCode;
    user.billingAddressNumber = dto.addressNumber;
    await this.usersRepository.save(user);

    const subscription = this.subscriptionsRepository.create({
      userId,
      plan: dto.plan,
      status: SubscriptionStatus.PENDING,
      priceBRL,
      couponCode,
      discountApplied: discountBRL,
      billingType: dto.billingType,
    });
    const saved = await this.subscriptionsRepository.save(subscription);

    // Cupom de 100% - nada a cobrar na Asaas, ativa direto.
    if (totalBRL <= 0) {
      await this.activateSubscriptionRecord(saved, user, couponId, couponCode);
      return {
        subscriptionId: saved.id,
        priceBRL,
        discountBRL,
        totalBRL,
        couponValid,
        ...(couponId ? { couponId } : {}),
        billingType: null,
        status: SubscriptionStatus.ACTIVE,
      };
    }

    try {
      const customerId = await this.asaasService.getOrCreateCustomer(
        user.asaasCustomerId,
        {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          cpfCnpj: dto.cpfCnpj,
          phone: user.phone,
          postalCode: dto.postalCode,
          addressNumber: dto.addressNumber,
          externalReference: user.id,
        },
      );
      if (!user.asaasCustomerId) {
        user.asaasCustomerId = customerId;
        await this.usersRepository.save(user);
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      const payment = await this.asaasService.createPayment({
        customer: customerId,
        billingType: dto.billingType,
        value: totalBRL,
        dueDate: dueDateStr,
        description: `VitrinePro - Plano ${PLAN_NAMES[dto.plan]}`,
        externalReference: saved.id,
        remoteIp,
        ...(dto.billingType === AsaasBillingType.CREDIT_CARD && dto.creditCard
          ? {
              creditCard: dto.creditCard,
              creditCardHolderInfo: {
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                cpfCnpj: dto.cpfCnpj,
                postalCode: dto.postalCode,
                addressNumber: dto.addressNumber,
                phone: user.phone || undefined,
              },
            }
          : {}),
      });

      saved.asaasPaymentId = payment.id;
      saved.invoiceUrl = payment.invoiceUrl || payment.bankSlipUrl || null;
      saved.dueDate = dueDate;
      await this.subscriptionsRepository.save(saved);

      const result: CheckoutResult = {
        subscriptionId: saved.id,
        priceBRL,
        discountBRL,
        totalBRL,
        couponValid,
        ...(couponId ? { couponId } : {}),
        billingType: dto.billingType,
        status: saved.status,
        invoiceUrl: saved.invoiceUrl ?? undefined,
      };

      if (dto.billingType === AsaasBillingType.PIX) {
        try {
          const qr = await this.asaasService.getPixQrCode(payment.id);
          result.pixQrCode = qr.encodedImage;
          result.pixCopyPaste = qr.payload;
          result.pixExpirationDate = qr.expirationDate;
        } catch (err) {
          this.logger.warn(`Falha ao buscar QR code Pix: ${(err as Error).message}`);
        }
      }

      if (
        dto.billingType === AsaasBillingType.CREDIT_CARD &&
        ['CONFIRMED', 'RECEIVED'].includes(payment.status)
      ) {
        await this.activateSubscriptionRecord(saved, user, couponId, couponCode);
        result.status = SubscriptionStatus.ACTIVE;
      } else if (dto.billingType === AsaasBillingType.CREDIT_CARD) {
        // Pagamento por cartao nao confirmado de imediato - trata como recusa.
        await this.subscriptionsRepository.remove(saved);
        throw new BadRequestException(
          'Pagamento recusado pelo cartao. Verifique os dados ou tente outro metodo.',
        );
      }

      return result;
    } catch (err) {
      // Se a cobranca falhou, nao deixa uma assinatura PENDING orfa.
      if (err instanceof BadRequestException) {
        const stillPending = await this.subscriptionsRepository.findOne({
          where: { id: saved.id },
        });
        if (stillPending && stillPending.status === SubscriptionStatus.PENDING) {
          await this.subscriptionsRepository.remove(stillPending);
        }
      }
      throw err;
    }
  }

  /** Chamado pelo webhook da Asaas quando um pagamento e confirmado/recebido. */
  async activateFromAsaasPaymentId(asaasPaymentId: string): Promise<void> {
    const subscription = await this.subscriptionsRepository.findOne({
      where: { asaasPaymentId },
    });
    if (!subscription) {
      this.logger.warn(
        `Webhook Asaas: nenhuma assinatura encontrada para payment ${asaasPaymentId}.`,
      );
      return;
    }
    if (subscription.status !== SubscriptionStatus.PENDING) {
      return; // ja processada - idempotente (Asaas pode reenviar o mesmo evento)
    }

    const user = await this.usersRepository.findOne({ where: { id: subscription.userId } });
    if (!user) {
      this.logger.error(`Webhook Asaas: usuario ${subscription.userId} nao encontrado.`);
      return;
    }

    let couponId: string | undefined;
    if (subscription.couponCode) {
      const validation = await this.couponsService.validate(
        subscription.couponCode,
        user.id,
      );
      if (validation.valid && validation.coupon) couponId = validation.coupon.id;
    }

    await this.activateSubscriptionRecord(subscription, user, couponId, subscription.couponCode);
  }

  /** Ativa a assinatura + atualiza plano do usuario. Compartilhado entre checkout (100% off / cartao sincrono) e webhook. */
  private async activateSubscriptionRecord(
    subscription: Subscription,
    user: User,
    couponId: string | undefined,
    couponCode: string | null,
  ): Promise<void> {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.startsAt = now;
    subscription.endsAt = new Date(now.getTime() + thirtyDays);
    await this.subscriptionsRepository.save(subscription);

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

    if (couponCode && couponId) {
      try {
        await this.couponsService.createRedemption(couponId, user.id, subscription.id);
      } catch {
        // Ignora duplicata - usuario ja resgatou esse cupom antes.
      }
    }
  }
}
