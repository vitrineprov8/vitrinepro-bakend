import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApplicationSource } from '../vaga-application.entity';

/**
 * Query params for GET /applications/me-as-team (T-T04 — Consultoria:
 * Pipeline Geral agregado de todas as vagas do time).
 */
export class ListTeamApplicationsDto {
  @IsOptional()
  @IsUUID()
  vagaId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  pipelineStage?: string;

  @IsOptional()
  @IsIn(Object.values(ApplicationSource))
  source?: ApplicationSource;

  @IsOptional()
  @IsString()
  q?: string;
}
