import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { ProjectImage } from './project-image.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectImage]), TagsModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
