import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PlanTier } from '../../users/user.entity';

/** Body for PATCH /admin/users/:id/plan (B24 — A6). Só ADMIN. */
export class UpdateUserPlanDto {
  @IsEnum(PlanTier)
  plan: PlanTier;

  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da alteração de plano.' })
  @MaxLength(500)
  reason: string;
}
