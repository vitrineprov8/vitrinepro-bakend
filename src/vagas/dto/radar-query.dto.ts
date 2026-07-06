import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/pagination.dto';
import { VagaSegment, VagaType, VagaWorkMode } from '../vaga.entity';

export class RadarQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(VagaSegment)
  segment?: VagaSegment;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(VagaType)
  type?: VagaType;

  @IsOptional()
  @IsEnum(VagaWorkMode)
  workMode?: VagaWorkMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMin?: number;

  /** B4 — Marketplace de hunters: só vagas com allowHunters=true (T-H07). */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allowHunters?: boolean;

  /** B4 — filtro "fee mínimo (R$)" do marketplace. Compara contra vaga.feeAmount. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  feeMin?: number;

  /**
   * Ordering strategy:
   *   recent     — most recently published first (default)
   *   relevance  — title matches ranked above description matches, then by publishedAt
   *   fee        — B4: maior feeAmount primeiro (nulls por último) — marketplace de hunters
   *   salary     — B21: maior salaryMax primeiro (nulls por último) — resto do T05
   */
  @IsOptional()
  @IsEnum(['recent', 'relevance', 'fee', 'salary'])
  order?: 'recent' | 'relevance' | 'fee' | 'salary';
}
