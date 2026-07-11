import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApplicationSource } from '../vaga-application.entity';

/**
 * Query params for GET /applications/me-as-owner (T-E05 — Empresa: Candidatos
 * de todas as vagas). Also reused by GET /applications/me-as-owner/export.
 */
export class ListOwnerApplicationsDto {
  @IsOptional()
  @IsUUID()
  vagaId?: string;

  @IsOptional()
  @IsString()
  pipelineStage?: string;

  @IsOptional()
  @IsIn(Object.values(ApplicationSource))
  source?: ApplicationSource;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'false' || value === '0') return false;
    if (value === 'true' || value === '1') return true;
    return value;
  })
  isRejected?: boolean;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
