import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DiscountType } from '../coupon.entity';

/** Body para POST /admin/coupons/campaigns (A5 — Cupons de campanha). */
export class CreateCouponCampaignDto {
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'O código deve conter apenas letras maiúsculas, números, hífen ou underscore.' })
  code: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @IsPositive()
  discountValue: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usageLimit?: number;
}
