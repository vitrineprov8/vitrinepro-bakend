import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User, UserRole } from '../users/user.entity';
import { PlacementsService } from './placements.service';
import { MarkHiredDto } from './dto/mark-hired.dto';
import { ContestPlacementDto } from './dto/contest-placement.dto';
import { ReportDepartureDto } from './dto/report-departure.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { UpdatePlacementSplitDto } from './dto/update-placement-split.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Post('applications/:id/placement')
  markHired(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: MarkHiredDto,
  ) {
    return this.placementsService.markHired(id, req.user.id, req.user.role, dto);
  }

  @Post('placements/:id/confirm')
  confirm(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.placementsService.confirm(id, req.user.id, req.user.role);
  }

  @Post('placements/:id/contest')
  contest(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ContestPlacementDto,
  ) {
    return this.placementsService.contest(id, req.user.id, dto);
  }

  @Post('placements/:id/resolve-dispute')
  resolveDispute(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.placementsService.resolveDispute(id, req.user.id, req.user.role, dto);
  }

  @Post('placements/:id/departure')
  reportDeparture(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: ReportDepartureDto,
  ) {
    return this.placementsService.reportDeparture(id, req.user.id, req.user.role, dto);
  }

  @Get('placements/:id/timeline')
  getTimeline(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.placementsService.getTimeline(id, req.user.id, req.user.role);
  }

  @Get('me/placements/hunter')
  listMineAsHunter(@Request() req: { user: { id: string } }) {
    return this.placementsService.listForHunter(req.user.id);
  }

  @Get('me/placements/company')
  listMineAsCompany(@Request() req: { user: { id: string } }) {
    return this.placementsService.listForCompany(req.user.id);
  }

  /**
   * GET /placements/me-as-team
   * T-T07 — Consultoria: Faturamento & Ganhos (tabela de placements do time,
   * com Cliente + Hunter/Membro responsável). 403 se não estiver em time.
   */
  @Get('placements/me-as-team')
  listMineAsTeam(@Request() req: { user: User }) {
    return this.placementsService.listForTeam(req.user);
  }

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

  @Get('admin/empresas')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminListCompanies(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.placementsService.adminListCompanies(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Patch('admin/empresas/:id/placement-split')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminUpdatePlacementSplit(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdatePlacementSplitDto,
  ) {
    return this.placementsService.adminUpdatePlacementSplit(id, req.user.id, dto);
  }
}
