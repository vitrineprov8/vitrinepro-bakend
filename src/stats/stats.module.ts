import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaga } from '../vagas/vaga.entity';
import { User } from '../users/user.entity';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vaga, User])],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
