import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamInvitePublicController } from './team-invite-public.controller';
import { TeamContextHelper } from './team-context.helper';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMember, User, Vaga])],
  providers: [TeamsService, TeamContextHelper],
  controllers: [TeamsController, TeamInvitePublicController],
  exports: [TeamsService, TeamContextHelper],
})
export class TeamsModule {}
