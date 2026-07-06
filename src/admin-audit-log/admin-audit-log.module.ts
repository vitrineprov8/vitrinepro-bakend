import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from './admin-audit-log.entity';
import { AdminAuditLogService } from './admin-audit-log.service';
import { AdminAuditLogController } from './admin-audit-log.controller';

/**
 * B23 — global (mesmo padrão de MailModule/StorageModule) para que qualquer
 * módulo possa injetar AdminAuditLogService sem precisar reimportar.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLog])],
  providers: [AdminAuditLogService],
  controllers: [AdminAuditLogController],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
