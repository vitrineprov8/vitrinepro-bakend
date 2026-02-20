import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { randomUUID } from 'crypto';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.storageService.validateImage(file.buffer, file.mimetype);
    const processed = await this.storageService.processImage(file.buffer, 'content');
    const key = `content/${req.user.id}/${randomUUID()}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');
    return { url };
  }
}
