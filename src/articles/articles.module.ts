import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './article.entity';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [TypeOrmModule.forFeature([Article]), TagsModule],
  providers: [ArticlesService],
  controllers: [ArticlesController],
})
export class ArticlesModule {}
