import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for PATCH /applications/:id/stage-notes/:stageKey
 */
export class UpdateStageNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observacoes?: string;

  /** Per-stage numeric rating 0.0–10.0.  Null clears an existing rating. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  nota?: number | null;
}
