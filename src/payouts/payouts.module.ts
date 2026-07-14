import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './payout.entity';
import { User } from '../users/user.entity';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { AsaasTransfersWebhookController } from './asaas-transfers-webhook.controller';
import { PaymentsModule } from '../payments/payments.module';

// B25 — pagamento da comissão do hunter (fee share) via Asaas Transfers.
// Não importa PlacementsModule (evita ciclo) — o hook de criação do payout
// mora em PlacementsService, que importa PayoutsModule e chama
// PayoutsService.createForPlacement() diretamente.
@Module({
  imports: [
    TypeOrmModule.forFeature([Payout, User]),
    PaymentsModule,
  ],
  providers: [PayoutsService],
  controllers: [PayoutsController, AsaasTransfersWebhookController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
