import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string | null;
  postalCode?: string | null;
  addressNumber?: string | null;
  externalReference?: string;
}

export interface AsaasCreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreatePaymentInput {
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  externalReference: string;
  creditCard?: AsaasCreditCardInput;
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
  };
  remoteIp?: string;
}

export interface AsaasPayment {
  id: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate?: string;
  value?: number;
}

/**
 * Integração com o gateway de pagamento Asaas (B11).
 * Docs: https://docs.asaas.com — auth via header `access_token` (não Bearer),
 * User-Agent obrigatório em contas criadas após 13/06/2024.
 */
@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly apiKey = process.env.ASAAS_API_KEY;
  private readonly baseUrl = (
    process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3'
  ).replace(/\/$/, '');
  private readonly webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;

  get enabled(): boolean {
    return !!this.apiKey;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new BadRequestException(
        'Gateway de pagamento não configurado (ASAAS_API_KEY ausente).',
      );
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        access_token: this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'VitrinePro/1.0',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok) {
      const description =
        data?.errors?.[0]?.description || `Erro Asaas (${res.status})`;
      this.logger.error(`Asaas ${method} ${path} falhou: ${description}`);
      throw new BadRequestException(description);
    }

    return data as T;
  }

  /**
   * Reaproveita `user.asaasCustomerId` se já existir; senão cria um customer novo.
   * O chamador é responsável por persistir o id retornado no User.
   */
  async getOrCreateCustomer(
    existingCustomerId: string | null,
    input: AsaasCustomerInput,
  ): Promise<string> {
    if (existingCustomerId) return existingCustomerId;

    const customer = await this.request<{ id: string }>('POST', '/customers', {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      phone: input.phone || undefined,
      postalCode: input.postalCode || undefined,
      addressNumber: input.addressNumber || undefined,
      externalReference: input.externalReference,
    });

    return customer.id;
  }

  async createPayment(input: AsaasCreatePaymentInput): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', '/payments', input);
  }

  async getPixQrCode(paymentId: string): Promise<{
    encodedImage: string;
    payload: string;
    expirationDate: string;
  }> {
    return this.request('GET', `/payments/${paymentId}/pixQrCode`);
  }

  /** Compara o header `asaas-access-token` do webhook com o token configurado no painel Asaas. */
  isValidWebhookToken(headerToken: string | undefined): boolean {
    if (!this.webhookToken) {
      // Sem token configurado ainda — aceita, mas loga o risco (só pra ambiente de sandbox inicial).
      this.logger.warn(
        'ASAAS_WEBHOOK_TOKEN não configurado — webhook aceito sem validação de origem.',
      );
      return true;
    }
    return headerToken === this.webhookToken;
  }
}
