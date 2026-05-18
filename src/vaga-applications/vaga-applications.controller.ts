import {
  Body,
  Controller,
  Get,
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
}
