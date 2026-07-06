import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Education } from '../education/education.entity';
import { CV } from '../cv/cv.entity';
import { Tag } from '../tags/tag.entity';
import { PortfolioItem } from '../portfolio/portfolio.entity';
import { PortfolioFile } from '../portfolio/portfolio-file.entity';
import { Vaga } from '../vagas/vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Coupon } from '../coupons/coupon.entity';
import { CouponRedemption } from '../coupons/coupon-redemption.entity';
import { VagaPublishLedger } from '../vaga-publish-ledger/vaga-publish-ledger.entity';
import { PipelineTemplate } from '../pipeline-templates/pipeline-template.entity';
import { Company } from '../companies/company.entity';
import { Team } from '../teams/team.entity';
import { TeamMember } from '../teams/team-member.entity';
import { SavedVaga } from '../saved-vagas/saved-vaga.entity';
import { SavedFilter } from '../saved-filters/saved-filter.entity';
import { HunterInterest } from '../hunter-interests/hunter-interest.entity';
import { HunterCandidate } from '../hunter-candidates/hunter-candidate.entity';
import { ProcessShareLink } from '../process-share/process-share-link.entity';
import { SlugTombstone } from '../seo/slug-tombstone.entity';
import { Placement } from '../placements/placement.entity';
import { AdminAuditLog } from '../admin-audit-log/admin-audit-log.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
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
    HunterCandidate,
    ProcessShareLink,
    SlugTombstone,
    Placement,
    AdminAuditLog,
  ],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
};
