import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * B11 - checkout real via Asaas. Cria (ou reaproveita) o customer, gera a
   * cobranca (PIX/BOLETO/CREDIT_CARD) e retorna os dados pra tela de checkout
   * (QR code Pix, link do boleto, ou o status ja ativo se cartao foi aprovado
   * na hora / cupom cobriu 100%). Ativacao de PIX/BOLETO chega depois via
   * webhook (POST /webhooks/asaas) - o frontend faz polling em GET /:id.
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @Req() req: ExpressRequest & { user: { id: string } },
    @Body() dto: CheckoutDto,
  ) {
    return this.subscriptionsService.checkout(req.user.id, dto, req.ip);
  }

  /**
   * Returns the authenticated user's subscription history, most recent first.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(@Req() req: ExpressRequest & { user: { id: string } }) {
    return this.subscriptionsService.listByUser(req.user.id);
  }

  /** Status de uma assinatura especifica - usado pro polling da tela de checkout (Pix/boleto aguardando confirmacao). */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Req() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.subscriptionsService.findOneForUser(id, req.user.id);
  }
}
