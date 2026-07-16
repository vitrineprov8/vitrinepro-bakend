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
import { User } from '../users/user.entity';
import { Placement } from '../placements/placement.entity';

/**
 * "Faturas de fee" — spec `design-spec/05_WORKSPACE_EMPRESA.md §T-E07`.
 *
 * Fecha um gap real do B11: quando um placement vindo de hunter é marcado
 * HIRED, o fee (`Placement.feeAmount`) nunca era de fato COBRADO da empresa
 * — só calculado e, mais tarde (B25), pago ao hunter. Esta entidade é a
 * cobrança real (via Asaas) desse valor. `type` fica pronto para outros
 * tipos do spec (`SUBSCRIPTION`/`BOOST`) mas hoje só `FEE` é emitido aqui —
 * assinaturas continuam no fluxo próprio de `subscriptions/` (não migrado).
 *
 * Regra "inadimplência bloqueia publish" (T-E07): fatura `OVERDUE` há mais
 * de 7 dias bloqueia novas publicações do dono da vaga (ver
 * `InvoicesService.hasBlockingDelinquency` + `VagasService.publish`).
 */
export enum InvoiceType {
  FEE = 'FEE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  BOOST = 'BOOST',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  DISPUTED = 'DISPUTED',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dono da vaga (quem deve pagar) — não necessariamente quem marcou o hire (pode ser membro de time). */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: User | null;

  @Index('IDX_invoices_companyId')
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Placement, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'placementId' })
  placement: Placement | null;

  @Index('IDX_invoices_placementId', { unique: true })
  @Column({ type: 'uuid', nullable: true })
  placementId: string | null;

  @Column({ type: 'varchar', length: 16, default: InvoiceType.FEE })
  type: InvoiceType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'timestamp' })
  dueDate: Date;

  @Index('IDX_invoices_status')
  @Column({ type: 'varchar', length: 16, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | null;

  @Index('IDX_invoices_asaasPaymentId')
  @Column({ type: 'varchar', length: 64, nullable: true })
  asaasPaymentId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  invoiceUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  disputeReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  disputedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disputeResolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
