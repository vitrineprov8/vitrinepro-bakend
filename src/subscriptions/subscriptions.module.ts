import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, User]),
    CouponsModule,
    PaymentsModule,
  ],
  providers: [SubscriptionsService],
  controllers: [SubscriptionsController, AsaasWebhookController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
