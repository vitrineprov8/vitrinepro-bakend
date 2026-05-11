import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { PlanLimitGuard } from './plan-limit.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Vaga])],
  providers: [PlansService, PlanLimitGuard],
  controllers: [PlansController],
  exports: [PlansService, PlanLimitGuard],
})
export class PlansModule {}
