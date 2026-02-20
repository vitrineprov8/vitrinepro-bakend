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
import { EducationService } from './education.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('education')
@UseGuards(JwtAuthGuard)
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Get()
  findAll(@Request() req) {
    return this.educationService.findAllByUser(req.user.id);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateEducationDto) {
    return this.educationService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateEducationDto) {
    return this.educationService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.educationService.delete(id, req.user.id);
  }

  @Post(':id/certificate')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadCertificate(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.educationService.uploadCertificate(id, req.user.id, file);
  }
}
