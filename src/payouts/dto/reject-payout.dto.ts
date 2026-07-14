import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de POST /admin/payouts/:id/reject — motivo obrigatório (auditoria). */
export class RejectPayoutDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da rejeição.' })
  @MaxLength(500)
  reason: string;
}
