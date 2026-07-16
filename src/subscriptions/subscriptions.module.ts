import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, User]),
    CouponsModule,
    PaymentsModule,
    // Faturas de fee (T-E07) — o webhook único /webhooks/asaas agora faz
    // fan-out pra Subscriptions E Invoices (ambos usam Asaas Payments,
    // diferente do webhook separado de Transfers usado pelos Payouts do B25).
    InvoicesModule,
  ],
  providers: [SubscriptionsService],
  controllers: [SubscriptionsController, AsaasWebhookController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
