import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query() query: ListProjectsDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(@Param('slug') slug: string, @Request() req) {
    const userId = req.user?.id;
    return this.projectsService.findBySlug(slug, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Request() req) {
    return this.projectsService.delete(id, req.user.id);
  }

  @Post(':id/cover')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadCover(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.projectsService.uploadCover(id, req.user.id, file);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  addImage(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    return this.projectsService.addImage(id, req.user.id, file, caption);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Request() req,
  ) {
    return this.projectsService.deleteImage(id, imageId, req.user.id);
  }

  @Patch(':id/images/reorder')
  @UseGuards(JwtAuthGuard)
  reorderImages(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { orders: { id: string; order: number }[] },
  ) {
    return this.projectsService.reorderImages(id, req.user.id, body.orders);
  }
}
