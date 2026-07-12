import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HunterCandidate } from './hunter-candidate.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { Vaga } from '../vagas/vaga.entity';
import { User } from '../users/user.entity';
import { Placement } from '../placements/placement.entity';
import { HunterCandidatesController } from './hunter-candidates.controller';
import { HunterCandidatesService } from './hunter-candidates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HunterCandidate, VagaApplication, Vaga, User, Placement]),
  ],
  controllers: [HunterCandidatesController],
  providers: [HunterCandidatesService],
  exports: [HunterCandidatesService],
})
export class HunterCandidatesModule {}
