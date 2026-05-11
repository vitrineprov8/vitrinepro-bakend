import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PlanTier } from '../../users/user.entity';

export class CheckoutDto {
  @IsEnum(PlanTier, { message: 'Plano inválido.' })
  plan: PlanTier;

  @IsOptional()
  @IsString()
  @Length(1, 32, { message: 'Código de cupom inválido.' })
  couponCode?: string;
}
