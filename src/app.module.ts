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
import { ArticlesModule } from './articles/articles.module';
import { ProjectsModule } from './projects/projects.module';
import { UploadsModule } from './uploads/uploads.module';

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
    ArticlesModule,
    ProjectsModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
