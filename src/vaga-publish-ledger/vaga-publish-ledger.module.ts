import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VagaPublishLedger } from './vaga-publish-ledger.entity';
import { VagaPublishLedgerService } from './vaga-publish-ledger.service';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VagaPublishLedger]),
    // TeamContextHelper allows getUsage() to resolve the quota owner for
    // MANAGER/RECRUITER members — they count against the team owner's ledger.
    TeamsModule,
  ],
  providers: [VagaPublishLedgerService],
  exports: [VagaPublishLedgerService],
})
export class VagaPublishLedgerModule {}
