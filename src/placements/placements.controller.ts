import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { PlacementsService } from './placements.service';
import { MarkHiredDto } from './dto/mark-hired.dto';
import { ContestPlacementDto } from './dto/contest-placement.dto';
import { ReportDepartureDto } from './dto/report-departure.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  /** P1 — "Marcar contratado". Dono da vaga, delegado de time (B15) ou admin. */
  @Post('applications/:id/placement')
  markHired(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: MarkHiredDto,
  ) {
    return this.placementsService.markHired(id, req.user.id, req.user.role, dto);
  }

  /** P2 — hunter confirma os dados do placement. */
  @Post('placements/:id/confirm')
  confirm(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.placementsService.confirm(id, req.user.id, req.user.role);
  }

  /** P2 — hunter contesta os dados do placement (abre disputa). */
  @Post('placements/:id/contest')
  contest(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ContestPlacementDto,
  ) {
    return this.placementsService.contest(id, req.user.id, dto);
  }

  /** A3 — admin resolve uma disputa (confirma ou cancela o placement). */
  @Post('placements/:id/resolve-dispute')
  resolveDispute(
    @Param('id') id: string,
    @Request() req: { user: { role: UserRole } },
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.placementsService.resolveDispute(id, req.user.role, dto);
  }

  /** P4 — empresa reporta que o candidato saiu dentro da garantia. */
  @Post('placements/:id/departure')
  reportDeparture(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: ReportDepartureDto,
  ) {
    return this.placementsService.reportDeparture(id, req.user.id, req.user.role, dto);
  }

  /** P3 — timeline do placement (dono da vaga/delegado, hunter da indicação ou admin). */
  @Get('placements/:id/timeline')
  getTimeline(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.placementsService.getTimeline(id, req.user.id, req.user.role);
  }

  /** "Minha mesa" do hunter — placements onde ele é o hunter da indicação. */
  @Get('me/placements/hunter')
  listMineAsHunter(@Request() req: { user: { id: string } }) {
    return this.placementsService.listForHunter(req.user.id);
  }

  /** Placements das vagas criadas pelo usuário logado (lado empresa/dono da vaga). */
  @Get('me/placements/company')
  listMineAsCompany(@Request() req: { user: { id: string } }) {
    return this.placementsService.listForCompany(req.user.id);
  }

  /**
   * QA-only — força a transição de tempo (auto-confirm 7d / liberação de fee
   * 90d) de um placement específico, sem esperar os dias reais se passarem.
   * Bloqueado em produção; restrito a ADMIN.
   */
  @Post('placements/:id/qa-force-sweep')
  qaForceAdvance(
    @Param('id') id: string,
    @Request() req: { user: { role: UserRole } },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Indisponível em produção.');
    }
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Só administradores podem usar este endpoint de QA.');
    }
    return this.placementsService.qaForceAdvance(id);
  }
}
