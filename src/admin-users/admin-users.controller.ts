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
import { AdminUsersService } from './admin-users.service';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserPlanDto } from './dto/update-user-plan.dto';
import { AdminReasonDto } from './dto/admin-reason.dto';

/** B24 (A6) — admin de usuários. Todas as rotas: só ADMIN. */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  list(@Query() query: QueryAdminUsersDto) {
    return this.adminUsersService.list(query);
  }

  @Patch(':id/plan')
  updatePlan(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateUserPlanDto,
  ) {
    return this.adminUsersService.updatePlan(id, req.user.id, dto);
  }

  @Post(':id/promote-admin')
  promoteToAdmin(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AdminReasonDto,
  ) {
    return this.adminUsersService.promoteToAdmin(id, req.user.id, dto.reason);
  }

  @Post(':id/demote-admin')
  demoteFromAdmin(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AdminReasonDto,
  ) {
    return this.adminUsersService.demoteFromAdmin(id, req.user.id, dto.reason);
  }

  @Post(':id/login-as')
  loginAs(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AdminReasonDto,
  ) {
    return this.adminUsersService.loginAs(id, req.user.id, dto.reason);
  }

  @Delete(':id')
  anonymize(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AdminReasonDto,
  ) {
    return this.adminUsersService.anonymize(id, req.user.id, dto.reason);
  }
}
