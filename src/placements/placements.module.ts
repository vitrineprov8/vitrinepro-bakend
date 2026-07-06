import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Placement } from './placement.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { Vaga } from '../vagas/vaga.entity';
import { User } from '../users/user.entity';
import { TeamsModule } from '../teams/teams.module';
import { MailModule } from '../mail/mail.module';
import { PlacementsService } from './placements.service';
import { PlacementsController } from './placements.controller';

// B9 — Placements. TeamsModule para delegação (B15); MailModule para as
// notificações transacionais do fluxo (hired/confirmed/disputed/etc).
@Module({
  imports: [
    TypeOrmModule.forFeature([Placement, VagaApplication, Vaga, User]),
    TeamsModule,
    MailModule,
  ],
  providers: [PlacementsService],
  controllers: [PlacementsController],
  exports: [PlacementsService],
})
export class PlacementsModule {}
