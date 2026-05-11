import {
  Body,
  Controller,
  Delete,
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
import { UserRole } from '../users/user.entity';
import { PlanLimitGuard } from '../plans/plan-limit.guard';
import { VagasService } from './vagas.service';
import { CreateVagaDto } from './dto/create-vaga.dto';
import { UpdateVagaDto } from './dto/update-vaga.dto';
import { ListVagasDto } from './dto/list-vagas.dto';

@Controller('vagas')
export class VagasController {
  constructor(private readonly vagasService: VagasService) {}

  /** Public listing of published, non-expired vagas */
  @Get()
  list(@Query() query: ListVagasDto) {
    return this.vagasService.listPublic(query);
  }

  /** Returns only the vagas created by the authenticated user */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(
    @Request() req: { user: { id: string } },
    @Query() query: ListVagasDto,
  ) {
    return this.vagasService.listMine(req.user.id, query);
  }

  /** Admin-only: see all vagas regardless of owner */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listAdmin(@Query() query: ListVagasDto) {
    return this.vagasService.listAdmin(query);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.vagasService.findBySlugPublic(slug);
  }

  /**
   * Creates a new vaga for the authenticated user.
   * Requires an active paid plan (enforced by PlanLimitGuard).
   * Admins bypass the plan limit.
   */
  @Post()
  @UseGuards(JwtAuthGuard, PlanLimitGuard)
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateVagaDto,
  ) {
    return this.vagasService.create(req.user.id, dto);
  }

  /** Updates a vaga — only the owner or an admin can modify it */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: UpdateVagaDto,
  ) {
    return this.vagasService.update(id, dto, req.user.id, req.user.role);
  }

  /** Deletes a vaga — only the owner or an admin can delete it */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.vagasService.remove(id, req.user.id, req.user.role);
  }
}
