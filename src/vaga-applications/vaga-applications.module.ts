import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VagaApplication } from './vaga-application.entity';
import { Vaga } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';
import { User } from '../users/user.entity';
import { VagaApplicationsService } from './vaga-applications.service';
import { VagaApplicationsController } from './vaga-applications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VagaApplication, Vaga, CV, User])],
  providers: [VagaApplicationsService],
  controllers: [VagaApplicationsController],
})
export class VagaApplicationsModule {}
