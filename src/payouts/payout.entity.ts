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
 * B25 — pagamento da comissão do hunter (fee share), executado via Asaas
 * Transfers API. Decisão arquitetural (pedido explícito do Andres,
 * 2026-07-14): aprovação MANUAL por um admin (segurança — alguém precisa
 * validar antes do dinheiro sair) + execução AUTOMÁTICA pelo sistema assim
 * que aprovado (o admin não digita nada manualmente na Asaas — o backend
 * chama `AsaasService.createPixTransfer()` na hora do approve). O admin tem
 * visibilidade completa do pipeline (`/app/admin/payouts`) — status de cada
 * etapa, dados usados na transferência e o resultado (sucesso/falha).
 *
 * Fluxo de status:
 * PENDING_REVIEW  -> criado quando o Placement vira FEE_RELEASED.
 * APPROVED        -> transitório (admin aprovou, sistema ainda não chamou a Asaas).
 * PROCESSING      -> chamada à Asaas feita, aguardando confirmação (webhook) ou
 *                    já retornou uma transferência pendente/agendada.
 * PAID            -> transferência confirmada (resposta síncrona DONE ou webhook TRANSFER_DONE).
 * REJECTED        -> admin rejeitou (motivo obrigatório) — dados incorretos, fraude, etc.
 * FAILED          -> a chamada à Asaas falhou ou o webhook reportou falha/cancelamento.
 */
export enum PayoutStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum PixKeyType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  EVP = 'EVP', // chave aleatória
}

export enum PayoutLegalType {
  PF = 'PF',
  PJ = 'PJ',
  MEI = 'MEI',
}

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Placement, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'placementId' })
  placement: Placement | null;

  @Index('IDX_payouts_placementId', { unique: true })
  @Column({ type: 'uuid' })
  placementId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hunterId' })
  hunter: User | null;

  @Index('IDX_payouts_hunterId')
  @Column({ type: 'uuid' })
  hunterId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Index('IDX_payouts_status')
  @Column({ type: 'varchar', length: 24, default: PayoutStatus.PENDING_REVIEW })
  status: PayoutStatus;

  // Snapshot dos dados de recebimento no momento em que o payout foi criado
  // (auditoria — não muda retroativamente se o hunter editar os dados depois,
  // exceto enquanto ainda está PENDING_REVIEW, ver PayoutsService.configurePayoutData).
  @Column({ type: 'varchar', length: 140, nullable: true })
  pixKeySnapshot: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  pixKeyTypeSnapshot: PixKeyType | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  legalTypeSnapshot: PayoutLegalType | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cpfCnpjSnapshot: string | null;

  /** Nota fiscal (upload PDF), obrigatória apenas se legalTypeSnapshot for PJ/MEI. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  nfUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  nfKey: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedByAdminId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  /** ID da transferência retornado por `POST /v3/transfers` na Asaas. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  asaasTransferId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
