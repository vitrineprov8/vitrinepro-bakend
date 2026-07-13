import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { PlacementStatus } from '../placement.entity';

/** Filtros de GET /admin/placements (A4 — auditoria global). */
export class QueryAdminPlacementsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PlacementStatus)
  status?: PlacementStatus;

  @IsOptional()
  @IsUUID()
  vagaId?: string;

  @IsOptional()
  @IsUUID()
  hunterId?: string;

  /** Filtra pela empresa dona da vaga (vaga.createdById). */
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
