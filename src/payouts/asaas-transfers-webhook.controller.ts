import { Body, Controller, Headers, HttpCode, Logger, Post } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { AsaasService } from '../payments/asaas.service';

interface AsaasTransferWebhookBody {
  event: string;
  transfer?: { id: string; status: string; failReason?: string };
}

/**
 * B25 — recebe eventos de webhook de TRANSFERÊNCIAS da Asaas (separado do
 * webhook de cobranças em subscriptions/asaas-webhook.controller.ts — a
 * Asaas trata "Cobranças" e "Transferências" como categorias de webhook
 * distintas no painel, ver docs.asaas.com/docs/webhook-para-transferencias).
 *
 * Fecha o loop assíncrono do pipeline de payout: `PayoutsService.approve()`
 * já tenta resolver o status na hora (síncrono), mas transferências que
 * ficam PENDING/BANK_PROCESSING na resposta inicial só viram PAID/FAILED
 * quando este webhook chega — é o que dá ao admin certeza de que "está tudo
 * certo" sem precisar ficar checando manualmente.
 *
 * Sem @UseGuards — endpoint público chamado pela Asaas; autenticado via
 * header `asaas-access-token` (mesmo mecanismo do webhook de cobranças).
 */
@Controller('webhooks/asaas/transfers')
export class AsaasTransfersWebhookController {
  private readonly logger = new Logger(AsaasTransfersWebhookController.name);

  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly asaasService: AsaasService,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Body() body: AsaasTransferWebhookBody,
    @Headers('asaas-access-token') token: string | undefined,
  ) {
    if (!this.asaasService.isValidWebhookToken(token)) {
      this.logger.warn('Webhook de transferências Asaas recebido com token inválido — ignorado.');
      return { received: true };
    }

    const transferId = body.transfer?.id;
    if (!transferId) return { received: true };

    try {
      await this.payoutsService.handleTransferWebhook(
        transferId,
        body.event,
        body.transfer?.failReason,
      );
    } catch (err) {
      this.logger.error(
        `Erro ao processar webhook ${body.event} (transfer ${transferId}): ${(err as Error).message}`,
      );
    }

    return { received: true };
  }
}
