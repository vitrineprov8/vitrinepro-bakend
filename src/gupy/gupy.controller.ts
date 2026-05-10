import {
  Body,
  Controller,
  Delete,
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
import { GupyService } from './gupy.service';
import { CreateGupyConfigDto } from './dto/create-gupy-config.dto';
import { UpdateGupyConfigDto } from './dto/update-gupy-config.dto';
import { ImportJobsDto } from './dto/import-jobs.dto';

@Controller('admin/gupy/configs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class GupyController {
  constructor(private readonly gupyService: GupyService) {}

  @Get()
  list() {
    return this.gupyService.list();
  }

  @Post()
  create(@Body() dto: CreateGupyConfigDto) {
    return this.gupyService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGupyConfigDto) {
    return this.gupyService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gupyService.remove(id);
  }

  @Get(':id/remote-jobs')
  remoteJobs(@Param('id') id: string) {
    return this.gupyService.fetchRemoteJobs(id);
  }

  @Post(':id/import')
  import(@Param('id') id: string, @Request() req, @Body() dto: ImportJobsDto) {
    return this.gupyService.importJobs(id, req.user.id, dto.jobIds);
  }

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.gupyService.syncJobs(id);
  }
}
