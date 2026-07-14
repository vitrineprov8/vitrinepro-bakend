import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlanTier } from '../../users/user.entity';
import { AsaasBillingType } from '../subscription.entity';

export class CreditCardDto {
  @IsNotEmpty({ message: 'Nome no cartão é obrigatório.' })
  @IsString()
  holderName: string;

  @IsNotEmpty({ message: 'Número do cartão é obrigatório.' })
  @IsString()
  number: string;

  @IsNotEmpty()
  @IsString()
  expiryMonth: string;

  @IsNotEmpty()
  @IsString()
  expiryYear: string;

  @IsNotEmpty({ message: 'CVV é obrigatório.' })
  @IsString()
  ccv: string;
}

/**
 * B11 — payload real de checkout (M3 do design-spec): dados de cobrança
 * (CPF/CNPJ + endereço, exigidos pela Asaas pra criar o customer/cobrança)
 * + método de pagamento (PIX/BOLETO gerados direto; CREDIT_CARD cobrado
 * de forma síncrona via API, sem redirecionar pra fora do app).
 */
export class CheckoutDto {
  @IsEnum(PlanTier, { message: 'Plano inválido.' })
  plan: PlanTier;

  @IsOptional()
  @IsString()
  @Length(1, 32, { message: 'Código de cupom inválido.' })
  couponCode?: string;

  @IsEnum(AsaasBillingType, { message: 'Forma de pagamento inválida.' })
  billingType: AsaasBillingType;

  @IsNotEmpty({ message: 'CPF/CNPJ é obrigatório.' })
  @IsString()
  cpfCnpj: string;

  @IsNotEmpty({ message: 'CEP é obrigatório.' })
  @IsString()
  postalCode: string;

  @IsNotEmpty({ message: 'Número do endereço é obrigatório.' })
  @IsString()
  addressNumber: string;

  @ValidateIf((dto: CheckoutDto) => dto.billingType === AsaasBillingType.CREDIT_CARD)
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;
}
