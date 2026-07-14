import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body de POST /admin/payouts/:id/approve — nota opcional (auditoria). */
export class ApprovePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
