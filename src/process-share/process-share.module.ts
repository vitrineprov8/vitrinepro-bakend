import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessShareLink } from './process-share-link.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { Vaga } from '../vagas/vaga.entity';
import { User } from '../users/user.entity';
import { ProcessShareService } from './process-share.service';
import { PdfService } from './pdf.service';
import { ProcessShareController } from './process-share.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessShareLink, VagaApplication, Vaga, User]),
  ],
  providers: [ProcessShareService, PdfService],
  controllers: [ProcessShareController],
  exports: [ProcessShareService],
})
export class ProcessShareModule {}
