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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { VagaApplicationsService } from './vaga-applications.service';
import { ApplyDto } from './dto/apply.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateGeneralDto } from './dto/update-general.dto';
import { UpdateStageNotesDto } from './dto/update-stage-notes.dto';

@Controller()
export class VagaApplicationsController {
  constructor(
    private readonly applicationsService: VagaApplicationsService,
  ) {}

  @Post('vagas/:slug/apply')
  @UseGuards(JwtAuthGuard)
  apply(
    @Request() req: { user: { id: string } },
    @Param('slug') slug: string,
    @Body() dto: ApplyDto,
  ) {
    return this.applicationsService.apply(req.user.id, slug, dto);
  }

  @Get('me/applications')
  @UseGuards(JwtAuthGuard)
  listMine(@Request() req: { user: { id: string } }) {
    return this.applicationsService.listMine(req.user.id);
  }

  /**
   * Lists applications for a specific vaga.
   * Accessible by the vaga creator or an admin — ownership is enforced in the service.
   */
  @Get('vagas/:id/applications')
  @UseGuards(JwtAuthGuard)
  listByVaga(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.applicationsService.listByVaga(id, req.user.id, req.user.role);
  }

  /**
   * Moves an application to a different pipeline stage.
   *
   * Body: { pipelineStage?: string, isRejected?: boolean }
   * At least one field must be present.
   *
   * Only the vaga creator or an admin may call this endpoint.
   */
  @Patch('applications/:id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: UpdateStatusDto,
  ) {
    return this.applicationsService.updateStatus(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * Removes the authenticated user's own application (candidate self-delete).
   *
   * Only the applicant (application.userId === req.user.id) may delete.
   * Returns 204 No Content on success.
   */
  @Delete('applications/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeApplication(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.applicationsService.removeApplication(id, req.user.id);
  }

  // ── Phase 3 endpoints ─────────────────────────────────────────────────────

  /**
   * PATCH /applications/:id/general
   * Updates generalScore and/or generalNote for the candidate.
   * Only the vaga creator or admin may call this.
   */
  @Patch('applications/:id/general')
  @UseGuards(JwtAuthGuard)
  updateGeneral(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: UpdateGeneralDto,
  ) {
    return this.applicationsService.updateGeneral(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * PATCH /applications/:id/stage-notes/:stageKey
   * Creates or merges recruiter notes for a specific pipeline stage.
   */
  @Patch('applications/:id/stage-notes/:stageKey')
  @UseGuards(JwtAuthGuard)
  updateStageNotes(
    @Param('id') id: string,
    @Param('stageKey') stageKey: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: UpdateStageNotesDto,
  ) {
    return this.applicationsService.updateStageNotes(
      id,
      stageKey,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * GET /applications/:id/history
   * Returns stageHistory in reverse-chronological order with author names.
   */
  @Get('applications/:id/history')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.applicationsService.getHistory(id, req.user.id, req.user.role);
  }
}
