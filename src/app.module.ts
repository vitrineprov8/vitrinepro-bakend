import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from './database/database.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { ProfileModule } from './profile/profile.module';
import { EducationModule } from './education/education.module';
import { CvModule } from './cv/cv.module';
import { TagsModule } from './tags/tags.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { UploadsModule } from './uploads/uploads.module';
import { SearchModule } from './search/search.module';
import { SeedModule } from './seed/seed.module';
import { VagasModule } from './vagas/vagas.module';
import { VagaApplicationsModule } from './vaga-applications/vaga-applications.module';
import { VagaPublishLedgerModule } from './vaga-publish-ledger/vaga-publish-ledger.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CouponsModule } from './coupons/coupons.module';
import { PipelineTemplatesModule } from './pipeline-templates/pipeline-templates.module';
import { CompaniesModule } from './companies/companies.module';
import { TeamsModule } from './teams/teams.module';
import { SavedVagasModule } from './saved-vagas/saved-vagas.module';
import { SavedFiltersModule } from './saved-filters/saved-filters.module';
import { HunterInterestsModule } from './hunter-interests/hunter-interests.module';
import { HunterCandidatesModule } from './hunter-candidates/hunter-candidates.module';
import { ProcessShareModule } from './process-share/process-share.module';
import { SeoModule } from './seo/seo.module';
import { StatsModule } from './stats/stats.module';
import { MailModule } from './mail/mail.module';
import { HuntersModule } from './hunters/hunters.module';
import { PlacementsModule } from './placements/placements.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    MailModule,
    StorageModule,
    UsersModule,
    AuthModule,
    ProfileModule,
    EducationModule,
    CvModule,
    TagsModule,
    PortfolioModule,
    UploadsModule,
    SearchModule,
    VagasModule,
    VagaApplicationsModule,
    VagaPublishLedgerModule,
    PlansModule,
    SubscriptionsModule,
    CouponsModule,
    PipelineTemplatesModule,
    CompaniesModule,
    TeamsModule,
    SavedVagasModule,
    SavedFiltersModule,
    HunterInterestsModule,
    HunterCandidatesModule,
    ProcessShareModule,
    SeoModule,
    StatsModule,
    HuntersModule,
    PlacementsModule,
    ...(process.env.NODE_ENV !== 'production' ? [SeedModule] : []),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}