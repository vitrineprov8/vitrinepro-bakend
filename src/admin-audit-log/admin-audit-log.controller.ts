import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AdminAuditLogService } from './admin-audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @Get('admin/audit-log')
  list(@Query() query: QueryAuditLogDto) {
    return this.auditLogService.list(query);
  }
}
