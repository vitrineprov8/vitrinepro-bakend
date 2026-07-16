import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vaga } from './vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { HunterInterest } from '../hunter-interests/hunter-interest.entity';
import { Company } from '../companies/company.entity';
import { Team } from '../teams/team.entity';
import { TeamMember } from '../teams/team-member.entity';
import { User } from '../users/user.entity';
import { VagasService } from './vagas.service';
import { VagasController } from './vagas.controller';
import { AdminVagasController } from './admin-vagas.controller';
import { VagaPublishLedgerModule } from '../vaga-publish-ledger/vaga-publish-ledger.module';
import { TeamsModule } from '../teams/teams.module';
import { SeoModule } from '../seo/seo.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vaga, VagaApplication, HunterInterest, Company, Team, TeamMember, User]),
    // Provides VagaPublishLedgerService for publish slot tracking.
    // PlansModule (PlanLimitGuard) has been removed — limit enforcement
    // now lives inside VagasService.publish(), not at the guard layer.
    VagaPublishLedgerModule,
    // TeamContextHelper for resolving quota owner and team-wide listings.
    TeamsModule,
    SeoModule,
    // Faturas de fee (T-E07) — bloqueio de publish por inadimplência.
    InvoicesModule,
  ],
  providers: [VagasService],
  controllers: [VagasController, AdminVagasController],
  exports: [VagasService],
})
export class VagasModule {}
