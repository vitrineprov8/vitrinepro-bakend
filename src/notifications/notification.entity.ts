import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * B13 — eventos que geram notificação in-app (sino), conforme
 * `design-spec/06_ADMIN_E_FLUXOS_TRANSVERSAIS.md` §N. Cada valor tem um
 * default de canais em `NOTIFICATION_DEFAULT_CHANNELS` (notification-preference.entity.ts).
 */
export enum NotificationType {
  CANDIDATE_SUBMITTED = 'CANDIDATE_SUBMITTED',
  STAGE_CHANGED = 'STAGE_CHANGED',
  HUNTER_INTEREST_REQUESTED = 'HUNTER_INTEREST_REQUESTED',
  HUNTER_INTEREST_DECIDED = 'HUNTER_INTEREST_DECIDED',
  CONSENT_REQUESTED = 'CONSENT_REQUESTED',
  PLACEMENT_HIRED = 'PLACEMENT_HIRED',
  PLACEMENT_CONFIRMED = 'PLACEMENT_CONFIRMED',
  PLACEMENT_DISPUTED = 'PLACEMENT_DISPUTED',
  PLACEMENT_GUARANTEE_BROKEN = 'PLACEMENT_GUARANTEE_BROKEN',
  PLACEMENT_FEE_RELEASED = 'PLACEMENT_FEE_RELEASED',
  TEAM_INVITE = 'TEAM_INVITE',
  VERIFICATION_DECIDED = 'VERIFICATION_DECIDED',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_notifications_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  /** Deep link pro front (ex.: `/app/hunter/vagas/:id`). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  link: string | null;

  /** Dados extra pro front (placementId, applicationId, etc) — não usado hoje pra lógica no backend. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Index('IDX_notifications_readAt')
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
