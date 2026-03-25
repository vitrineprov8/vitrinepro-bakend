import { Controller, Post, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { SeedService } from './seed.service';

/**
 * SeedController — development-only endpoints.
 *
 * POST   /seed/run    — insert 10 fake professionals with portfolio items
 * DELETE /seed/clear  — remove all seed data (identified by @vitrinepro.dev email suffix)
 *
 * This controller (and its module) is only registered when NODE_ENV !== 'production'.
 */
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  run() {
    return this.seedService.run();
  }

  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  clear() {
    return this.seedService.clear();
  }
}
