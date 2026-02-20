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
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  findAll(@Query() query: ListArticlesDto) {
    return this.articlesService.findAll(query);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  findBySlug(@Param('slug') slug: string, @Request() req) {
    const userId = req.user?.id;
    return this.articlesService.findBySlug(slug, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Request() req) {
    return this.articlesService.delete(id, req.user.id);
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
    return this.articlesService.uploadCover(id, req.user.id, file);
  }
}
