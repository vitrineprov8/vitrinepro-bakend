import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaga } from '../vagas/vaga.entity';
import { User } from '../users/user.entity';
import { Placement } from '../placements/placement.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { HunterInterest } from '../hunter-interests/hunter-interest.entity';
import { CouponRedemption } from '../coupons/coupon-redemption.entity';
import { SavedVaga } from '../saved-vagas/saved-vaga.entity';
import { TeamsModule } from '../teams/teams.module';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vaga,
      User,
      Placement,
      VagaApplication,
      HunterInterest,
      CouponRedemption,
      SavedVaga,
    ]),
    TeamsModule,
  ],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
