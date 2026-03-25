import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PortfolioItem } from '../portfolio/portfolio.entity';

/**
 * SearchModule — provides public search and autocomplete over published
 * portfolio items.  DataSource is provided automatically by TypeOrmModule
 * registered in AppModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PortfolioItem])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
