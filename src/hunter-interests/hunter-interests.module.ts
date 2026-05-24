import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HunterInterest } from './hunter-interest.entity';
import { Vaga } from '../vagas/vaga.entity';
import { HunterInterestsService } from './hunter-interests.service';
import { HunterInterestsController } from './hunter-interests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HunterInterest, Vaga])],
  providers: [HunterInterestsService],
  controllers: [HunterInterestsController],
})
export class HunterInterestsModule {}
