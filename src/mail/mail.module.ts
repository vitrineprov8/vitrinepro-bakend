import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global para que qualquer módulo possa injetar MailService sem re-importar
 * (auth/B2, hunter-candidates/B3, teams/B7, subscriptions/B11...).
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
