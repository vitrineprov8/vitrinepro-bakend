import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Team } from '../teams/team.entity';
import { TeamMember } from '../teams/team-member.entity';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Team, TeamMember])],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
