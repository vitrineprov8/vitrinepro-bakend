import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/** Body for PATCH /admin/empresas/:id/placement-split (B22). Só ADMIN. */
export class UpdatePlacementSplitDto {
  /** Novo percentual da plataforma no split do fee (0-100). O hunter fica com o restante. */
  @IsInt()
  @Min(0)
  @Max(100)
  platformSharePercent: number;

  /** Motivo obrigatório — vira entrada em `User.placementSplitHistory`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
