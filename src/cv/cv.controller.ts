import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CvService } from './cv.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req) {
    return this.cvService.findAllByUser(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  upload(
    @Request() req,
    @Body('label') label: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.cvService.upload(req.user.id, label, file);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { label?: string; isActive?: boolean },
  ) {
    return this.cvService.update(id, req.user.id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Request() req) {
    return this.cvService.delete(id, req.user.id);
  }

  @Get(':id/download')
  getDownloadUrl(@Param('id') id: string) {
    return this.cvService.getDownloadUrl(id);
  }
}
