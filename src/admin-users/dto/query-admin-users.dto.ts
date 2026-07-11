import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

/** Filtros de GET /admin/users (B24 — A6). */
export class QueryAdminUsersDto extends PaginationDto {
  /** Busca por nome ou e-mail (case-insensitive, substring). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Filtra por persona (CANDIDATO/HUNTER/EMPRESA). */
  @IsOptional()
  @IsString()
  persona?: string;

  /** Filtra por plano (FREE/RECRUITER/TEAM/ENTERPRISE). */
  @IsOptional()
  @IsString()
  plan?: string;
}
