import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Team } from '../teams/team.entity';
import { TeamMember } from '../teams/team-member.entity';
import { PortfolioItem } from '../portfolio/portfolio.entity';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { SeoModule } from '../seo/seo.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Team, TeamMember, PortfolioItem]), SeoModule],
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
