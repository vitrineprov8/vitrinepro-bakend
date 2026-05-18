import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
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
    // SeedModule is only active outside production to prevent accidental data
    // insertion or exposure of unauthenticated mutation endpoints in prod.
    ...(process.env.NODE_ENV !== 'production' ? [SeedModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
