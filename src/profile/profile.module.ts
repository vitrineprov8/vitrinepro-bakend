import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Team } from '../teams/team.entity';
import { TeamMember } from '../teams/team-member.entity';
import { PortfolioItem } from '../portfolio/portfolio.entity';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { CompanyPublicController } from './company-public.controller';
import { SeoModule } from '../seo/seo.module';
import { VagasModule } from '../vagas/vagas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Team, TeamMember, PortfolioItem]),
    SeoModule,
    VagasModule,
  ],
  providers: [ProfileService],
  controllers: [ProfileController, CompanyPublicController],
})
export class ProfileModule {}
