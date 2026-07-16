import { Controller, Post, Body, UseGuards, Get, Request, HttpCode, HttpStatus, Res, Req, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService, DeviceInfo } from './auth.service';
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
  constructor(private authService: AuthService) {}

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
