import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationPreference } from './notification-preference.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * B13 — `@Global()` (mesmo padrão de `MailModule`/`AdminAuditLogModule`):
 * qualquer service injeta `NotificationsService` sem reimportar o módulo.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationPreference, User])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
