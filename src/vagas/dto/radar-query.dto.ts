import {
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

  /**
   * Ordering strategy:
   *   recent     — most recently published first (default)
   *   relevance  — title matches ranked above description matches, then by publishedAt
   */
  @IsOptional()
  @IsEnum(['recent', 'relevance'])
  order?: 'recent' | 'relevance';
}
