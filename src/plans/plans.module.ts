import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PlanLimitGuard } from './plan-limit.guard';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Vaga]),
    // TeamContextHelper is exported from TeamsModule — imported here so
    // PlansService can resolve team membership for plan inheritance.
    TeamsModule,
  ],
  providers: [PlansService, PlanLimitGuard],
  controllers: [PlansController],
  exports: [PlansService, PlanLimitGuard],
})
export class PlansModule {}
