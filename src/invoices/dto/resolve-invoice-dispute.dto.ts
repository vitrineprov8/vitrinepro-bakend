import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum InvoiceDisputeResolution {
  MARK_PAID = 'MARK_PAID',
  REOPEN = 'REOPEN',
}

/** Body de POST /admin/invoices/:id/resolve-dispute (mesmo padrão de resolve-dispute.dto.ts de placements). */
export class ResolveInvoiceDisputeDto {
  @IsEnum(InvoiceDisputeResolution, { message: 'Resolução inválida.' })
  resolution: InvoiceDisputeResolution;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
