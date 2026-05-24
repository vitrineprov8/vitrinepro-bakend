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
import { SetActiveContextDto } from './dto/set-active-context.dto';
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

  /**
   * Sets or clears the active team context for the authenticated user.
   *
   * Body: { teamId: string | null }
   *  - null   → personal context (clear activeContextTeamId)
   *  - UUID   → act on behalf of this team (must be owner or active member)
   *
   * The active context is exposed via GET /profile/me as `activeContextTeamId`.
   * VagaEditor uses it to show "Publicando como: Empresa X".
   */
  @Patch('me/active-context')
  @UseGuards(JwtAuthGuard)
  setActiveContext(
    @Request() req,
    @Body() dto: SetActiveContextDto,
  ) {
    return this.profileService.setActiveContext(req.user.id, dto);
  }

  @Get(':username')
  getPublicProfile(@Param('username') username: string) {
    return this.profileService.getPublicProfile(username);
  }
}
