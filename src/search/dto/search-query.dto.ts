import {
  IsOptional,
  IsString,
  IsIn,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchQueryDto {
  /** Full-text search term (fuzzy matching via pg_trgm) */
  @IsOptional()
  @IsString()
  q?: string;

  /** Filter results by category */
  @IsOptional()
  @IsIn(['all', 'professional', 'specialty', 'project'])
  type?: string;

  /** Sort field */
  @IsOptional()
  @IsIn(['relevance', 'date', 'year'])
  sortBy?: string;

  /** Sort direction */
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: string;

  /** Filter by city substring (case-insensitive) */
  @IsOptional()
  @IsString()
  city?: string;

  /** Only return items that have (true) or don't have (false) a cover image */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  hasImage?: boolean;

  /** Filter by project lifecycle status */
  @IsOptional()
  @IsIn(['ONGOING', 'COMPLETED', 'PAUSED', 'CANCELLED'])
  projectStatus?: string;

  /** Inclusive lower bound on createdAt */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** Inclusive upper bound on createdAt */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Filter to only service items (isService = true) */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isService?: boolean;

  /** Filter items that contain a specific tag UUID */
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 1 : parsed;
  })
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 12 : parsed;
  })
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;
}
