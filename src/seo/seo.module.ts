import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SlugTombstone } from './slug-tombstone.entity';
import { SeoService } from './seo.service';
import { SeoController } from './seo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SlugTombstone]), ConfigModule],
  providers: [SeoService],
  controllers: [SeoController],
  // Export SeoService so PortfolioModule, ProfileModule, and VagasModule
  // can inject it without re-declaring the entity.
  exports: [SeoService],
})
export class SeoModule {}
