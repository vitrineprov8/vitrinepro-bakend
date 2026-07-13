import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { StatsService } from './stats.service';

@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** Público — contadores agregados para a Home. Sem autenticação. */
  @Get('stats/home')
  home() {
    return this.statsService.home();
  }

  /** B12 — cards do topo de `/app/hunter`. */
  @Get('stats/hunter')
  @UseGuards(JwtAuthGuard)
  hunterDashboard(@Request() req: { user: { id: string } }) {
    return this.statsService.hunterDashboard(req.user.id);
  }

  /** B12 — cards de `/app/hunter/ganhos` (T-H09). */
  @Get('stats/hunter/ganhos')
  @UseGuards(JwtAuthGuard)
  hunterGanhos(@Request() req: { user: { id: string } }) {
    return this.statsService.hunterGanhos(req.user.id);
  }

  /** B12 — cards do workspace Empresa (§05). Só contas `isCompany`. */
  @Get('stats/empresa')
  @UseGuards(JwtAuthGuard)
  empresaDashboard(@Request() req: { user: { id: string } }) {
    return this.statsService.empresaDashboard(req.user.id);
  }

  /** Cards do topo de `/app/candidato` (T-C02). */
  @Get('stats/candidato')
  @UseGuards(JwtAuthGuard)
  candidatoDashboard(@Request() req: { user: { id: string } }) {
    return this.statsService.candidatoDashboard(req.user.id);
  }

  /** B12 — KPIs + pipeline overview + feed de atividade do time (§04). Requer time (TEAM/ENTERPRISE). */
  @Get('stats/consultoria')
  @UseGuards(JwtAuthGuard)
  consultoriaDashboard(@Request() req: { user: { id: string } }) {
    return this.statsService.consultoriaDashboard(req.user.id);
  }

  /** B12 — "Placements & Ganhos" do time (consultoria). */
  @Get('stats/consultoria/ganhos')
  @UseGuards(JwtAuthGuard)
  consultoriaGanhos(@Request() req: { user: { id: string } }) {
    return this.statsService.consultoriaGanhos(req.user.id);
  }

  /** B12 — painel admin (§06). */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminDashboard() {
    return this.statsService.adminDashboard();
  }
}
