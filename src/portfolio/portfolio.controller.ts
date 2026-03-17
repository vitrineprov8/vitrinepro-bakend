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
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { ListPortfolioDto } from './dto/list-portfolio.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  findAll(@Query() query: ListPortfolioDto) {
    return this.portfolioService.findAll(query);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(@Param('slug') slug: string, @Request() req) {
    const userId = req.user?.id;
    return this.portfolioService.findBySlug(slug, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() dto: CreatePortfolioDto) {
    return this.portfolioService.create(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdatePortfolioDto) {
    return this.portfolioService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Request() req) {
    return this.portfolioService.delete(id, req.user.id);
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
    return this.portfolioService.uploadCover(id, req.user.id, file);
  }

  @Post(':id/files')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  addFile(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    return this.portfolioService.addFile(id, req.user.id, file, caption);
  }

  @Delete(':id/files/:fileId')
  @UseGuards(JwtAuthGuard)
  deleteFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Request() req,
  ) {
    return this.portfolioService.deleteFile(id, fileId, req.user.id);
  }

  @Patch(':id/files/reorder')
  @UseGuards(JwtAuthGuard)
  reorderFiles(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { orders: { id: string; order: number }[] },
  ) {
    return this.portfolioService.reorderFiles(id, req.user.id, body.orders);
  }
}
