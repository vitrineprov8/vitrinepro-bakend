import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req) {
    return this.tagsService.findAll(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body('name') name: string) {
    return this.tagsService.create(req.user.id, name);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Request() req) {
    return this.tagsService.delete(id, req.user.id);
  }
}
