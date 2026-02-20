import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body('name') name: string) {
    return this.tagsService.create(name);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string) {
    return this.tagsService.delete(id);
  }
}
