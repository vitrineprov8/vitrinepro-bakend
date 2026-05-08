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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
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
    @Request() req,
    @Param('slug') slug: string,
    @Body() dto: ApplyDto,
  ) {
    return this.applicationsService.apply(req.user.id, slug, dto);
  }

  @Get('me/applications')
  @UseGuards(JwtAuthGuard)
  listMine(@Request() req) {
    return this.applicationsService.listMine(req.user.id);
  }

  @Get('vagas/:id/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listByVaga(@Param('id') id: string) {
    return this.applicationsService.listByVaga(id);
  }

  @Patch('applications/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.applicationsService.updateStatus(id, dto.status);
  }
}
