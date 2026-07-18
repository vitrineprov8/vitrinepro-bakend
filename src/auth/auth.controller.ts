import { Controller, Post, Body, UseGuards, Get, Request, HttpCode, HttpStatus, Res, Req, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService, DeviceInfo } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import {
  EnableTwoFactorDto,
  DisableTwoFactorDto,
  RegenerateBackupCodesDto,
  VerifyTwoFactorDto,
} from './dto/two-factor.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { LinkedInAuthGuard } from './linkedin-auth.guard';

// B20 — throttle estrito nas rotas mais visadas por brute-force/enumeração
// (login, registro, forgot-password): 5 tentativas por minuto por IP,
// bem abaixo do limite 'default' global de 100/min do ThrottlerModule.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** B26 — extrai UA/IP da requisição pra gravar em `user_sessions`. */
function deviceInfoFrom(req: ExpressRequest): DeviceInfo {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body()
    registerDto: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
      isCompany?: boolean;
      companyName?: string;
      companyIndustry?: string;
      persona?: 'CANDIDATO' | 'HUNTER';
    },
    @Req() req: ExpressRequest,
  ) {
    return this.authService.register(registerDto, deviceInfoFrom(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body() loginDto: { email: string; password: string },
    @Req() req: ExpressRequest,
  ) {
    return this.authService.login(loginDto, deviceInfoFrom(req));
  }

  // ===== B2 — RESET DE SENHA =====
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('token') token: string,
    @Body() dto: { password: string },
  ) {
    return this.authService.resetPassword(token, dto.password);
  }

  // ===== B17 — VERIFICAÇÃO DE E-MAIL =====
  @Post('verify-email/:token')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async resendVerification(@Request() req) {
    return this.authService.resendEmailVerification(req.user.id);
  }

  // Conta/Dados de acesso — troca de senha autenticado (diferente do B2, que
  // é o fluxo "esqueci minha senha" sem estar logado).
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  // ===== B27 — 2FA (TOTP) =====
  // Gratuito e disponível em todos os planos: segurança de conta não é
  // recurso premium. Obrigatório para ADMIN (ver `TwoFactorService`).

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async twoFactorStatus(@Request() req) {
    return this.twoFactorService.getStatus(req.user.id);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async twoFactorSetup(@Request() req) {
    return this.twoFactorService.setup(req.user.id);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async twoFactorEnable(@Request() req, @Body() dto: EnableTwoFactorDto) {
    // `req.user.sessionId` vem do JwtStrategy (B26) — preserva a sessão atual
    // ao revogar as demais.
    return this.twoFactorService.enable(req.user.id, dto.code, req.user.sessionId);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async twoFactorDisable(@Request() req, @Body() dto: DisableTwoFactorDto) {
    return this.twoFactorService.disable(req.user.id, dto);
  }

  @Post('2fa/backup-codes')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async twoFactorBackupCodes(
    @Request() req,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    return this.twoFactorService.regenerateBackupCodes(req.user.id, dto.password);
  }

  /**
   * Segunda etapa do login. Público (quem chama ainda não tem sessão), com o
   * mesmo throttle estrito de `login` — é um alvo de força bruta: são só
   * 1.000.000 de combinações de 6 dígitos.
   */
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async twoFactorVerify(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: ExpressRequest,
  ) {
    return this.twoFactorService.verifyLoginChallenge(
      dto.challengeToken,
      dto.code,
      deviceInfoFrom(req),
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return {
      message: 'Perfil del usuario',
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    };
  }

  // ===== GOOGLE OAUTH =====
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirige a Google automáticamente
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: ExpressRequest, @Res() res: Response) {
    const token = await this.authService.createSession((req as any).user, deviceInfoFrom(req));
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }

  // ===== LINKEDIN OAUTH =====
  @Get('linkedin')
  @UseGuards(LinkedInAuthGuard)
  async linkedinAuth() {
    // Guard redirige a LinkedIn automáticamente
  }

  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  async linkedinAuthCallback(@Req() req: ExpressRequest, @Res() res: Response) {
    const token = await this.authService.createSession((req as any).user, deviceInfoFrom(req));
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
}
