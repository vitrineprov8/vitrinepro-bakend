import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/pagination.dto';

/**
 * B5 — Query do diretório público `GET /hunters` (T07).
 *
 * `order` aceita 'placements'/'rating' pela spec, mas como B9 (placements) e
 * B10 (avaliações) ainda não existem, ambos hoje se comportam como 'recent'
 * (ordena por updatedAt DESC) — ver nota em HuntersService.listDirectory.
 */
export class HuntersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  city?: string;

  /**
   * Default true na spec ("somente verificados"). `@Type(() => Boolean)` sozinho
   * NÃO funciona para query strings: `Boolean("false")` é `true` (qualquer string
   * não-vazia é truthy). Precisa de um transform explícito que interprete o texto.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'false' || value === '0') return false;
    if (value === 'true' || value === '1') return true;
    return value;
  })
  @IsBoolean()
  verifiedOnly?: boolean;

  @IsOptional()
  @IsEnum(['recent', 'placements', 'rating'])
  order?: 'recent' | 'placements' | 'rating';
}
