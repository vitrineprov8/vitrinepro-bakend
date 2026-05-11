import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaga } from './vaga.entity';
import { User } from '../users/user.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { VagasService } from './vagas.service';
import { VagasController } from './vagas.controller';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vaga, User, VagaApplication]),
    PlansModule, // provides PlanLimitGuard for POST /vagas
  ],
  providers: [VagasService],
  controllers: [VagasController],
  exports: [VagasService],
})
export class VagasModule {}
