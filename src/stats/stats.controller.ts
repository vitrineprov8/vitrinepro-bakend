import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** Público — contadores agregados para a Home. Sem autenticação. */
  @Get('home')
  home() {
    return this.statsService.home();
  }
}
