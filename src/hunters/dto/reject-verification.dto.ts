import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** B8 — corpo de `POST /admin/hunters/verifications/:userId/reject`. */
export class RejectVerificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da recusa.' })
  @MaxLength(1000)
  reason: string;
}
