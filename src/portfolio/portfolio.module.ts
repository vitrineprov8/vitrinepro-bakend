import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioItem } from './portfolio.entity';
import { PortfolioFile } from './portfolio-file.entity';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { TagsModule } from '../tags/tags.module';
import { StorageModule } from '../storage/storage.module';
import { SeoModule } from '../seo/seo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortfolioItem, PortfolioFile]),
    TagsModule,
    StorageModule,
    SeoModule,
  ],
  providers: [PortfolioService],
  controllers: [PortfolioController],
})
export class PortfolioModule {}
