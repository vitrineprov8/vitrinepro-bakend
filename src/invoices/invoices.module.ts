import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './invoice.entity';
import { User } from '../users/user.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PaymentsModule } from '../payments/payments.module';

// Faturas de fee (T-E07) — não importa PlacementsModule/VagasModule (evita
// ciclo, mesmo princípio do B25/PayoutsModule): são eles que importam
// InvoicesModule e chamam InvoicesService diretamente.
@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, User]),
    PaymentsModule,
  ],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
