import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

/**
 * SeedModule — only registered in non-production environments.
 *
 * DataSource is injected directly from the TypeORM connection established in
 * AppModule, so no additional TypeOrmModule.forFeature() imports are needed
 * here.
 */
@Module({
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
