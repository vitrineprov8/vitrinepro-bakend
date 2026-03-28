import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { FakeSeedService } from './fake-seed.service';
import { StorageService } from '../storage/storage.service';

/**
 * SeedModule — only registered in non-production environments.
 *
 * DataSource is injected directly from the TypeORM connection established in
 * AppModule, so no additional TypeOrmModule.forFeature() imports are needed
 * here.
 */
@Module({
  controllers: [SeedController],
  providers: [SeedService, FakeSeedService, StorageService],
})
export class SeedModule {}
