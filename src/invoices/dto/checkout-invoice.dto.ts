import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreditCardDto } from '../../subscriptions/dto/checkout.dto';

export enum InvoiceBillingType {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
}

/** Body de POST /invoices/:id/checkout — mesmo padrão de subscriptions/dto/checkout.dto.ts. */
export class CheckoutInvoiceDto {
  @IsEnum(InvoiceBillingType, { message: 'Forma de pagamento inválida.' })
  billingType: InvoiceBillingType;

  @IsNotEmpty({ message: 'CPF/CNPJ é obrigatório.' })
  @IsString()
  cpfCnpj: string;

  @IsNotEmpty({ message: 'CEP é obrigatório.' })
  @IsString()
  postalCode: string;

  @IsNotEmpty({ message: 'Número do endereço é obrigatório.' })
  @IsString()
  addressNumber: string;

  @ValidateIf((dto: CheckoutInvoiceDto) => dto.billingType === InvoiceBillingType.CREDIT_CARD)
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;
}
