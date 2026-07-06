import { IsEnum } from 'class-validator';
import { UserPersona } from '../../users/user.entity';

/**
 * B1 — Ativa uma persona adicional na conta do usuário autenticado.
 * Só aceita CANDIDATO/HUNTER — EMPRESA é definida no registro (isCompany)
 * e não pode ser auto-ativada por esta rota.
 */
export class ActivatePersonaDto {
  @IsEnum(UserPersona)
  persona: UserPersona;
}
