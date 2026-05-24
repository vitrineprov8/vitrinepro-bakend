import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for PATCH /applications/:id/general
 * At least one of generalScore or generalNote must be present.
 */
export class UpdateGeneralDto {
  /** Score 0.0–10.0 (one decimal allowed via validation). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  generalScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  generalNote?: string;
}
