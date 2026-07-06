import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog, AdminAuditAction } from './admin-audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { paginate, PaginatedResult } from '../common/paginate.helper';

export interface RecordAuditLogInput {
  adminId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId: string;
  reason?: string | null;
  payloadBefore?: Record<string, unknown> | null;
  payloadAfter?: Record<string, unknown> | null;
}

/**
 * B23 — helper central de gravação do audit log admin.
 *
 * Outros services chamam `record()` depois de uma ação administrativa
 * bem-sucedida (nunca antes — se a ação falhar, não deve virar log). Falha ao
 * gravar o log NÃO deve derrubar a ação em si (é auditoria, não a operação
 * principal) — por isso `record()` engole erros e só loga no console.
 */
@Injectable()
export class AdminAuditLogService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      const entry = this.auditLogRepository.create({
        adminId: input.adminId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason ?? null,
        payloadBefore: input.payloadBefore ?? null,
        payloadAfter: input.payloadAfter ?? null,
      });
      await this.auditLogRepository.save(entry);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[AdminAuditLog] falha ao gravar log: ${(err as Error).message}`);
    }
  }

  async list(query: QueryAuditLogDto): Promise<PaginatedResult<AdminAuditLog>> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (query.adminId) qb.andWhere('log.adminId = :adminId', { adminId: query.adminId });
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.targetType) qb.andWhere('log.targetType = :targetType', { targetType: query.targetType });
    if (query.targetId) qb.andWhere('log.targetId = :targetId', { targetId: query.targetId });

    return paginate(qb, query.page, query.limit);
  }
}
