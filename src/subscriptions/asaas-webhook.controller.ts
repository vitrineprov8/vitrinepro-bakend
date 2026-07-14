import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AsaasService } from '../payments/asaas.service';

interface AsaasWebhookBody {
  event: string;
  payment?: { id: string; status: string };
}

/**
 * B11 — recebe eventos de webhook da Asaas (sandbox ou produção).
 * Sem @UseGuards: é um endpoint público chamado pelo servidor da Asaas, não
 * pelo frontend — a autenticação é feita pelo header `asaas-access-token`
 * (comparado com ASAAS_WEBHOOK_TOKEN), configurado no painel Asaas.
 * Sempre responde 200 (mesmo em eventos irrelevantes) pra evitar retries
 * infinitos da Asaas; erros são só logados.
 */
@Controller('webhooks/asaas')
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly asaasService: AsaasService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Body() body: AsaasWebhookBody,
    @Headers('asaas-access-token') token: string | undefined,
  ) {
    if (!this.asaasService.isValidWebhookToken(token)) {
      this.logger.warn('Webhook Asaas recebido com token inválido — ignorado.');
      return { received: true };
    }

    const paymentId = body.payment?.id;
    if (!paymentId) return { received: true };

    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(body.event)) {
      try {
        await this.subscriptionsService.activateFromAsaasPaymentId(paymentId);
      } catch (err) {
        this.logger.error(
          `Erro ao processar webhook ${body.event} (payment ${paymentId}): ${(err as Error).message}`,
        );
      }
    }

    return { received: true };
  }
}
