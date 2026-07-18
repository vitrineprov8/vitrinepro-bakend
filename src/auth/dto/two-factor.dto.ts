import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/** B27 — confirma o segredo pendente e ativa o 2FA. */
export class EnableTwoFactorDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o código do app autenticador.' })
  @MaxLength(10)
  code: string;
}

/**
 * B27 — desativar exige reautenticação: senha (contas locais) ou um código
 * válido do app (contas OAuth, que não têm senha). O service decide qual
 * exigir, por isso os dois são opcionais aqui.
 */
export class DisableTwoFactorDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  code?: string;
}

/** B27 — gerar um conjunto novo de códigos de recuperação. */
export class RegenerateBackupCodesDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

/** B27 — segunda etapa do login: challenge token + código (TOTP ou recuperação). */
export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty({ message: 'Sessão de verificação ausente.' })
  challengeToken: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o código.' })
  @MaxLength(20)
  code: string;
}
