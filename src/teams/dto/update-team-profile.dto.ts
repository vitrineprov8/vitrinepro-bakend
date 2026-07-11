import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * T-T01/T-T08 — Perfil da consultoria (nome, logo, CNPJ opcional, bio pública).
 * Only the team OWNER may call the endpoint that uses this DTO.
 */
export class UpdateTeamProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}
