import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { InvoiceStatus } from '../invoice.entity';

/** Filtros de GET /admin/invoices. */
export class QueryAdminInvoicesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
