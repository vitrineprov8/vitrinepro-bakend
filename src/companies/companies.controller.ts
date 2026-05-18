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
import { User } from '../users/user.entity';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * Returns companies visible to the authenticated user.
   *
   * - OWNER / MANAGER: all companies owned by the team owner.
   * - RECRUITER: only companies where the recruiter is in assignedRecruiters.
   */
  @Get()
  listMine(@Request() req: { user: User }) {
    return this.companiesService.listMine(req.user);
  }

  /**
   * Creates a new client company.
   * The company is always owned by the team owner, even when created by a MANAGER.
   * RECRUITER: forbidden.
   */
  @Post()
  create(@Request() req: { user: User }, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(req.user, dto);
  }

  /**
   * Returns a single company by id.
   * RECRUITER: only if they are in assignedRecruiters; otherwise 404.
   */
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: User }) {
    return this.companiesService.findOne(id, req.user);
  }

  /**
   * Updates a company.
   * RECRUITER: forbidden.
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: { user: User },
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, req.user, dto);
  }

  /**
   * Deletes a company.
   * RECRUITER: forbidden.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: { user: User }) {
    return this.companiesService.remove(id, req.user);
  }

  /**
   * Replaces the set of recruiters assigned to a company.
   * RECRUITER: forbidden.
   * Each recruiterId must be an ACTIVE member of the team.
   */
  @Patch(':id/recruiters')
  setRecruiters(
    @Param('id') id: string,
    @Request() req: { user: User },
    @Body() dto: { recruiterIds: string[] },
  ) {
    return this.companiesService.setRecruiters(
      id,
      req.user,
      dto.recruiterIds ?? [],
    );
  }
}
