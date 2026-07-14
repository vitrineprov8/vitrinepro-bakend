import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User, PlanTier } from '../users/user.entity';

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum AsaasBillingType {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Indexed for fast lookup of all subscriptions by user */
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: PlanTier })
  plan: PlanTier;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  status: SubscriptionStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  priceBRL: number;

  /** Snapshot of the coupon code used at checkout (if any) */
  @Column({ type: 'varchar', length: 32, nullable: true })
  couponCode: string | null;

  /** Discount amount in BRL applied at checkout */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountApplied: number;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  // ── B11 — gateway de pagamento Asaas ─────────────────────────────────────
  @Column({ type: 'enum', enum: AsaasBillingType, nullable: true })
  billingType: AsaasBillingType | null;

  /** ID da cobrança (`payment`) criada na Asaas — chave de correlação do webhook. */
  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  asaasPaymentId: string | null;

  /** URL da fatura Asaas (boleto/PDF ou página hospedada). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  invoiceUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
