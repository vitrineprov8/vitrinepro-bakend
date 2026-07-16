import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de POST /invoices/:id/dispute — motivo obrigatório (vai ao Admin, spec T-E07). */
export class DisputeInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da contestação.' })
  @MaxLength(500)
  reason: string;
}
