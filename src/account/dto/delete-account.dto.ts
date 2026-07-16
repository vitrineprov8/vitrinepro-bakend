import { IsEmail } from 'class-validator';

/**
 * B26 — confirmação da exclusão de conta (design-spec §C: "confirm duplo
 * digitando e-mail"). O front já mostra a lista do que será apagado/
 * anonimizado antes de deixar o usuário digitar — aqui só validamos que o
 * e-mail digitado bate com o da própria conta (comparado no service).
 */
export class DeleteAccountDto {
  @IsEmail({}, { message: 'Digite um e-mail válido.' })
  email: string;
}
