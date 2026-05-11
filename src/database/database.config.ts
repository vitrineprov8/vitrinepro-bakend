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
  ],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
};
