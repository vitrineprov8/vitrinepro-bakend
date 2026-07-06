import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { HuntersService } from './hunters.service';
import { HuntersQueryDto } from './dto/hunters-query.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';

@Controller()
export class HuntersController {
  constructor(private readonly huntersService: HuntersService) {}

  // ── B5 — Diretório e perfil público ─────────────────────────────────────────

  /** T07 — diretório público de hunters. */
  @Get('hunters')
  listDirectory(@Query() query: HuntersQueryDto) {
    return this.huntersService.listDirectory(query);
  }

  /** T08 — perfil público `/hunter/[username]`. */
  @Get('hunters/:username')
  getPublicProfile(@Param('username') username: string) {
    return this.huntersService.getPublicProfile(username);
  }

  // ── B8 — Verificação (auto-serviço do hunter) ───────────────────────────────

  @Post('profile/me/verification/documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadVerificationDocument(
    @Request() req: { user: { id: string } },
    @Body('label') label: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.huntersService.uploadVerificationDocument(
      req.user.id,
      label,
      file,
    );
  }

  @Post('profile/me/verification/submit')
  @UseGuards(JwtAuthGuard)
  submitVerification(
    @Request() req: { user: { id: string } },
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.huntersService.submitVerification(req.user.id, dto);
  }

  // ── B8 — Fila de análise (admin) ────────────────────────────────────────────

  @Get('admin/hunters/verifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminListVerifications() {
    return this.huntersService.adminListVerifications();
  }

  @Post('admin/hunters/verifications/:userId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminApprove(
    @Param('userId') userId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.huntersService.adminApprove(userId, req.user.id);
  }

  @Post('admin/hunters/verifications/:userId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminReject(
    @Param('userId') userId: string,
    @Request() req: { user: { id: string } },
    @Body() dto: RejectVerificationDto,
  ) {
    return this.huntersService.adminReject(userId, req.user.id, dto);
  }
}
