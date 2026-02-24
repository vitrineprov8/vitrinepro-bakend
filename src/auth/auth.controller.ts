import { Controller, Post, Body, UseGuards, Get, Request, HttpCode, HttpStatus, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { LinkedInAuthGuard } from './linkedin-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body()
    registerDto: {
      email: string;
      firstName: string;
      lastName: string;
      password: string;
    },
  ) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: { email: string; password: string },
  ) {
    return this.authService.login(loginDto);
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
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    const token = this.authService.generateToken(req.user);
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
  async linkedinAuthCallback(@Req() req, @Res() res: Response) {
    const token = this.authService.generateToken(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
}
