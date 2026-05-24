import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedFilter } from './saved-filter.entity';
import { SavedFiltersService } from './saved-filters.service';
import { SavedFiltersController } from './saved-filters.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SavedFilter])],
  providers: [SavedFiltersService],
  controllers: [SavedFiltersController],
})
export class SavedFiltersModule {}
