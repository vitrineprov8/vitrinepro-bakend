import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { NotificationType } from './notification.entity';

/**
 * B13 — matriz de canais (sino/e-mail) × evento, por usuário (spec §C "Conta
 * > Notificações"). Uma linha só existe quando o usuário desvia do default —
 * `NotificationsService` funde com `NOTIFICATION_DEFAULT_CHANNELS` quando não
 * há override.
 *
 * **Dívida conhecida**: `emailEnabled` é persistido e devolvido pela API, mas
 * ainda NÃO bloqueia o envio real de e-mail — os `MailService.sendXxx(...)`
 * já existentes (verificação, placements, convite de time) continuam
 * disparando incondicionalmente. Só `inAppEnabled` de fato controla se o
 * sino recebe a notificação. Fechar isso é trabalho futuro (ver CLAUDE.md).
 */
@Entity('notification_preferences')
@Unique(['userId', 'type'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_notification_preferences_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  type: NotificationType;

  @Column({ type: 'boolean', default: true })
  inAppEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  emailEnabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}

/** Default de canais por evento (spec §N) — usado quando não há override do usuário. */
export const NOTIFICATION_DEFAULT_CHANNELS: Record<
  NotificationType,
  { inApp: boolean; email: boolean }
> = {
  [NotificationType.CANDIDATE_SUBMITTED]: { inApp: true, email: true },
  [NotificationType.STAGE_CHANGED]: { inApp: true, email: false },
  [NotificationType.HUNTER_INTEREST_REQUESTED]: { inApp: true, email: true },
  [NotificationType.HUNTER_INTEREST_DECIDED]: { inApp: true, email: true },
  [NotificationType.CONSENT_REQUESTED]: { inApp: true, email: true },
  [NotificationType.PLACEMENT_HIRED]: { inApp: true, email: true },
  [NotificationType.PLACEMENT_CONFIRMED]: { inApp: true, email: true },
  [NotificationType.PLACEMENT_DISPUTED]: { inApp: true, email: true },
  [NotificationType.PLACEMENT_GUARANTEE_BROKEN]: { inApp: true, email: true },
  [NotificationType.PLACEMENT_FEE_RELEASED]: { inApp: true, email: true },
  [NotificationType.TEAM_INVITE]: { inApp: true, email: true },
  [NotificationType.VERIFICATION_DECIDED]: { inApp: true, email: true },
};
