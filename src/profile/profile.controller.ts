import {
  Controller,
  Get,
  Patch,
  Post,
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
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetActiveContextDto } from './dto/set-active-context.dto';
import { PublicListQueryDto } from './dto/public-list-query.dto';
import { ActivatePersonaDto } from './dto/activate-persona.dto';
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
   * T-E08 — Página da Empresa: upload de capa/banner.
   * ProfileService.uploadBanner ja existia (mesmo padrão do avatar) mas
   * nunca tinha rota exposta — usado hoje pela Página da Empresa (T10/T-E08).
   */
  @Post('banner')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadBanner(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadBanner(req.user.id, file);
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

  /**
   * B1 — Ativa uma persona adicional (CANDIDATO/HUNTER) na conta autenticada.
   * Idempotente: já ativa não dá erro. EMPRESA não pode ser ativada aqui
   * (definida só no registro via isCompany).
   */
  @Patch('me/personas')
  @UseGuards(JwtAuthGuard)
  activatePersona(@Request() req, @Body() dto: ActivatePersonaDto) {
    return this.profileService.activatePersona(req.user.id, dto.persona);
  }

  /**
   * GET /profile/public-list?page=1&limit=20
   *
   * Public, no auth required.
   * Used by the sitemap generator to enumerate all indexable profiles.
   * Returns only `username` and `updatedAt` — no PII, minimal payload.
   * Max 100 items/page (vs 20 default).
   *
   * IMPORTANT: this route MUST appear before GET :username so NestJS
   * does not interpret "public-list" as a username path parameter.
   */
  @Get('public-list')
  getPublicList(@Query() query: PublicListQueryDto) {
    return this.profileService.getPublicList(query.page, query.limit);
  }

  @Get(':username')
  getPublicProfile(@Param('username') username: string) {
    return this.profileService.getPublicProfile(username);
  }
}
