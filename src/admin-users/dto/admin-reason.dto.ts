import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body genérico para ações admin que exigem motivo obrigatório (B24 — A6):
 * promover/remover ADMIN, login-as, anonimizar usuário.
 */
export class AdminReasonDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo desta ação.' })
  @MaxLength(500)
  reason: string;
}
