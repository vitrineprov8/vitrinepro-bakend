import { IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * B8 — corpo de `POST /profile/me/verification/submit`.
 * Os documentos em si já foram enviados antes via
 * `POST /profile/me/verification/documents` (multipart) e vivem em
 * `user.verificationDocs`; aqui só confirmamos o pedido e (opcionalmente)
 * atualizamos o link do LinkedIn usado na análise.
 */
export class SubmitVerificationDto {
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Informe uma URL válida do LinkedIn.' })
  linkedinUrl?: string;
}
