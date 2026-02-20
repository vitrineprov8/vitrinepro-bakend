import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Request() req) {
    return this.profileService.getMyProfile(req.user.id);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.id, dto);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadAvatar(req.user.id, file);
  }

  @Post('banner')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadBanner(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadBanner(req.user.id, file);
  }

  @Get(':username')
  getPublicProfile(@Param('username') username: string) {
    return this.profileService.getPublicProfile(username);
  }
}
