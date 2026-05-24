import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './users/user.entity';
import { Education } from './education/education.entity';
import { CV } from './cv/cv.entity';
import { Tag } from './tags/tag.entity';
import { PortfolioItem } from './portfolio/portfolio.entity';
import { PortfolioFile } from './portfolio/portfolio-file.entity';
import { Vaga } from './vagas/vaga.entity';
import { VagaApplication } from './vaga-applications/vaga-application.entity';
import { Subscription } from './subscriptions/subscription.entity';
import { Coupon } from './coupons/coupon.entity';
import { CouponRedemption } from './coupons/coupon-redemption.entity';
import { VagaPublishLedger } from './vaga-publish-ledger/vaga-publish-ledger.entity';
import { PipelineTemplate } from './pipeline-templates/pipeline-template.entity';
import { Company } from './companies/company.entity';
import { Team } from './teams/team.entity';
import { TeamMember } from './teams/team-member.entity';
import { SavedVaga } from './saved-vagas/saved-vaga.entity';
import { SavedFilter } from './saved-filters/saved-filter.entity';
import { HunterInterest } from './hunter-interests/hunter-interest.entity';
import { ProcessShareLink } from './process-share/process-share-link.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  entities: [
    User,
    Education,
    CV,
    Tag,
    PortfolioItem,
    PortfolioFile,
    Vaga,
    VagaApplication,
    Subscription,
    Coupon,
    CouponRedemption,
    VagaPublishLedger,
    PipelineTemplate,
    Company,
    Team,
    TeamMember,
    SavedVaga,
    SavedFilter,
    HunterInterest,
    ProcessShareLink,
  ],
  migrations: [
    'src/migrations/*.ts',
    'src/database/migrations/*.ts',
  ],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: true,
});
