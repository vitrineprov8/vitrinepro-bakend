import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { User, UserRole } from '../users/user.entity';
import { VagasService } from './vagas.service';
import { VagaPublishLedgerService } from '../vaga-publish-ledger/vaga-publish-ledger.service';
import { CreateVagaDto } from './dto/create-vaga.dto';
import { UpdateVagaDto } from './dto/update-vaga.dto';
import { ListVagasDto } from './dto/list-vagas.dto';
import { RadarQueryDto } from './dto/radar-query.dto';

class AssignVagaDto {
  @IsOptional()
  @IsUUID()
  userId: string | null;
}

@Controller('vagas')
export class VagasController {
  constructor(
    private readonly vagasService: VagasService,
    private readonly vagaPublishLedgerService: VagaPublishLedgerService,
  ) {}

  /** Public listing of published, non-expired vagas */
  @Get()
  list(@Query() query: ListVagasDto) {
    return this.vagasService.listPublic(query);
  }

  /** Returns the current user's publish slot usage for the active billing cycle */
  @Get('me/usage')
  @UseGuards(JwtAuthGuard)
  getUsage(@Request() req: { user: User }) {
    return this.vagaPublishLedgerService.getUsage(req.user);
  }

  /**
   * Returns vagas visible to the authenticated user.
   *
   * - OWNER:     all vagas in their team (own + all members).
   * - MANAGER:   all vagas in the team owner's scope.
   * - RECRUITER: all vagas in the team owner's scope.
   * - Solo user: only their own vagas.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(
    @Request() req: { user: User },
    @Query() query: ListVagasDto,
  ) {
    return this.vagasService.listMine(req.user, query);
  }

  /** Admin-only: see all vagas regardless of owner */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listAdmin(@Query() query: ListVagasDto) {
    return this.vagasService.listAdmin(query);
  }

  /**
   * Public radar — paginated, filterable list of PUBLISHED vagas.
   * No auth required. Supports: q, segment, city, type, workMode, salaryMin, order.
   *
   * IMPORTANT: this route must remain ABOVE @Get(':slug') so Express does not
   * treat "radar" as a slug value.
   */
  @Get('radar')
  radar(@Query() query: RadarQueryDto) {
    return this.vagasService.listRadar(query);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.vagasService.findBySlugPublic(slug);
  }

  /**
   * Creates a new vaga as a DRAFT.
   *
   * PlanLimitGuard has been intentionally removed from this endpoint — creating
   * a draft is free and does not consume any plan slot.  The limit is enforced
   * exclusively in POST /vagas/:id/publish.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: User },
    @Body() dto: CreateVagaDto,
  ) {
    return this.vagasService.create(req.user, dto);
  }

  /**
   * Publishes a vaga (DRAFT or CLOSED → PUBLISHED).
   *
   * This is the only way to move a vaga to PUBLISHED status.
   * Consumes 1 slot from the TEAM OWNER's plan for the current billing cycle.
   * MANAGER and RECRUITER publish against the owner's quota, not their own.
   * Slot consumption is irreversible — closing or deleting the vaga does NOT
   * return the slot.
   *
   * Re-publishing the same vaga in the same billing cycle does NOT consume
   * an additional slot (idempotent via the ledger unique index).
   *
   * Returns 409 if the vaga is already PUBLISHED.
   * Returns 403 with { code: 'PLAN_LIMIT_REACHED', used, limit, cycleEnd }
   * if the plan slot limit is reached.
   */
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(
    @Param('id') id: string,
    @Request() req: { user: User },
  ) {
    return this.vagasService.publish(id, req.user);
  }

  /**
   * Unpublishes (closes) a vaga (PUBLISHED → CLOSED).
   *
   * Does NOT refund the publish slot — the slot is permanently spent for this
   * billing cycle.  Use this to hide a vaga without deleting it.
   */
  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard)
  unpublish(
    @Param('id') id: string,
    @Request() req: { user: User },
  ) {
    return this.vagasService.unpublish(id, req.user);
  }

  /** Updates a vaga — owner, team manager, or admin can modify it.
   *  Setting status to PUBLISHED via this endpoint is rejected (use /publish). */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Request() req: { user: User },
    @Body() dto: UpdateVagaDto,
  ) {
    return this.vagasService.update(id, dto, req.user);
  }

  /**
   * Assigns or clears the responsible team member for a vaga.
   * Body: { userId: string | null }
   * - null → clear assignment
   * - UUID → assign to that ACTIVE team member
   */
  @Patch(':id/assign')
  @UseGuards(JwtAuthGuard)
  assign(
    @Param('id') id: string,
    @Request() req: { user: User },
    @Body() dto: AssignVagaDto,
  ) {
    return this.vagasService.assign(id, req.user.id, req.user.role, dto.userId ?? null);
  }

  /** Deletes a vaga — owner, team manager, or admin can delete it.
   *  Ledger records are preserved (FK SET NULL) so the slot remains consumed. */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @Request() req: { user: User },
  ) {
    return this.vagasService.remove(id, req.user);
  }
}
