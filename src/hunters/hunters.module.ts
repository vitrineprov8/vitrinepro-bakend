import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { HuntersController } from './hunters.controller';
import { HuntersService } from './hunters.service';
import { ReviewsModule } from '../reviews/reviews.module';

/**
 * B5 (perfil público de hunter) + B8 (verificação de hunter).
 * `StorageService`/`MailService` são `@Global()` (StorageModule/MailModule),
 * não precisam ser importados aqui. `ReviewsModule` fornece `ReviewsService`
 * pra agregação de avgRating/totalReviews em `getMetrics` (B10).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, VagaApplication]),
    ReviewsModule,
  ],
  controllers: [HuntersController],
  providers: [HuntersService],
  exports: [HuntersService],
})
export class HuntersModule {}
