import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { TeamMember } from '../teams/team-member.entity';
import { User } from '../users/user.entity';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, TeamMember, User]),
    // TeamContextHelper for resolving OWNER/MANAGER/RECRUITER visibility rules
    TeamsModule,
  ],
  providers: [CompaniesService],
  controllers: [CompaniesController],
  exports: [CompaniesService],
})
export class CompaniesModule {}
