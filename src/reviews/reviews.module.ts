import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HunterReview } from './hunter-review.entity';
import { Placement } from '../placements/placement.entity';
import { TeamsModule } from '../teams/teams.module';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

/**
 * B10 — avaliações de hunter (RN-NOVA-07). `TeamsModule` fornece
 * `TeamContextHelper` pra delegação de time (mesma checagem do B9/B15).
 * Exporta `ReviewsService` pra `HuntersModule` poder ler `getHunterStats()`
 * na agregação do perfil público (B5).
 */
@Module({
  imports: [TypeOrmModule.forFeature([HunterReview, Placement]), TeamsModule],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
