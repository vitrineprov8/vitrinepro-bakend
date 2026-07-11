import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for POST /admin/vagas/:id/unpublish (B24 — A6). Só ADMIN. */
export class AdminUnpublishVagaDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo da despublicação.' })
  @MaxLength(500)
  reason: string;
}
