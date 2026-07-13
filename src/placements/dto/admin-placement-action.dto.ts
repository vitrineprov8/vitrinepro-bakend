import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body para ações admin sobre um placement que exigem motivo obrigatório
 * (A4 — forçar liberação de fee / marcar estorno). */
export class AdminPlacementActionDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo desta ação.' })
  @MaxLength(500)
  reason: string;
}
