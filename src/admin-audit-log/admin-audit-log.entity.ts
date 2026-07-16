import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * B23 — audit log genérico de ações administrativas.
 *
 * Exigido pelo spec (design-spec/06_ADMIN_E_FLUXOS_TRANSVERSAIS.md §A4/A6:
 * "motivo logado" em forçar fee/estorno, alterar plano, login-as) e pelo B22
 * (mudança de split de placement é dinheiro — precisa rastro).
 *
 * `targetType`/`targetId` identificam o alvo da ação (ex.: targetType='User',
 * targetId=<userId da empresa> para uma mudança de split). `payloadBefore`/
 * `payloadAfter` guardam um snapshot mínimo do que mudou (não a entidade
 * inteira) — útil pra auditoria sem virar um dump genérico de toda a tabela.
 */
export enum AdminAuditAction {
  PLACEMENT_SPLIT_UPDATE = 'PLACEMENT_SPLIT_UPDATE',
  PLACEMENT_DISPUTE_RESOLVE = 'PLACEMENT_DISPUTE_RESOLVE',
  HUNTER_VERIFICATION_APPROVE = 'HUNTER_VERIFICATION_APPROVE',
  HUNTER_VERIFICATION_REJECT = 'HUNTER_VERIFICATION_REJECT',
  COUPON_REDEMPTION_VALIDATE = 'COUPON_REDEMPTION_VALIDATE',
  COUPON_REDEMPTION_REJECT = 'COUPON_REDEMPTION_REJECT',
  // B24 — admin de usuários/vagas
  USER_PLAN_UPDATE = 'USER_PLAN_UPDATE',
  USER_PROMOTE_ADMIN = 'USER_PROMOTE_ADMIN',
  USER_DEMOTE_ADMIN = 'USER_DEMOTE_ADMIN',
  USER_LOGIN_AS = 'USER_LOGIN_AS',
  USER_ANONYMIZE = 'USER_ANONYMIZE',
  VAGA_UNPUBLISH_ADMIN = 'VAGA_UNPUBLISH_ADMIN',
  // A4 — auditoria/força de placements
  PLACEMENT_FORCE_FEE_RELEASE = 'PLACEMENT_FORCE_FEE_RELEASE',
  PLACEMENT_FORCE_REFUND = 'PLACEMENT_FORCE_REFUND',
  // A5 — CRUD de cupons de campanha
  COUPON_CAMPAIGN_CREATE = 'COUPON_CAMPAIGN_CREATE',
  COUPON_CAMPAIGN_UPDATE = 'COUPON_CAMPAIGN_UPDATE',
  COUPON_CAMPAIGN_TOGGLE = 'COUPON_CAMPAIGN_TOGGLE',
  // B25 — revisão/execução de pagamento da comissão do hunter
  PAYOUT_APPROVE = 'PAYOUT_APPROVE',
  PAYOUT_REJECT = 'PAYOUT_REJECT',
  // Faturas de fee — resolução de disputa de fatura (T-E07)
  INVOICE_RESOLVE_DISPUTE = 'INVOICE_RESOLVE_DISPUTE',
}

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_admin_audit_logs_adminId')
  @Column({ type: 'uuid' })
  adminId: string;

  @Index('IDX_admin_audit_logs_action')
  @Column({ type: 'varchar', length: 64 })
  action: AdminAuditAction;

  @Index('IDX_admin_audit_logs_target')
  @Column({ type: 'varchar', length: 64 })
  targetType: string;

  @Column({ type: 'varchar', length: 64 })
  targetId: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payloadBefore: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  payloadAfter: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
