import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { VagaStatus, VagaType, VagaWorkMode } from '../vaga.entity';

export class ListVagasDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(VagaStatus)
  status?: VagaStatus;

  @IsOptional()
  @IsEnum(VagaType)
  type?: VagaType;

  @IsOptional()
  @IsEnum(VagaWorkMode)
  workMode?: VagaWorkMode;

  /** T-T03 — Consultoria: filtra "Vagas do Time" por cliente (Company). */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** T-T03 — Consultoria: filtra "Vagas do Time" por responsável (membro do time). */
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
