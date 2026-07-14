import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PixKeyType, PayoutLegalType } from '../payout.entity';

/** Body de PATCH /me/payout-config (T-H09 "Configurar recebimento"). */
export class ConfigurePayoutDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a chave Pix.' })
  @MaxLength(140)
  pixKey: string;

  @IsEnum(PixKeyType, { message: 'Tipo de chave Pix inválido.' })
  pixKeyType: PixKeyType;

  @IsEnum(PayoutLegalType, { message: 'Tipo de pessoa inválido.' })
  legalType: PayoutLegalType;

  @IsString()
  @IsNotEmpty({ message: 'Informe o CPF/CNPJ.' })
  @MaxLength(20)
  cpfCnpj: string;
}
