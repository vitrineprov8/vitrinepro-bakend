import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { HuntersController } from './hunters.controller';
import { HuntersService } from './hunters.service';

/**
 * B5 (perfil público de hunter) + B8 (verificação de hunter).
 * `StorageService`/`MailService` são `@Global()` (StorageModule/MailModule),
 * não precisam ser importados aqui.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, VagaApplication])],
  controllers: [HuntersController],
  providers: [HuntersService],
  exports: [HuntersService],
})
export class HuntersModule {}
