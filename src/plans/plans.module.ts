import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Vaga]),
    TeamsModule,
  ],
  providers: [PlansService],
  controllers: [PlansController],
  exports: [PlansService],
})
export class PlansModule {}
