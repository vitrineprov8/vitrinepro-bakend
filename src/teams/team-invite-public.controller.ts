import {
  Controller,
  Get,
  Post,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { TeamsService } from './teams.service';

/**
 * B7 — Rotas do convite de time por token, servindo a página pública
 * `/convite/[token]` do frontend.
 *
 * Separado de `TeamsController` (prefixo `me/team`) porque estas rotas
 * precisam de um path plano (`public/team-invite/:token` e
 * `team-invite/:token/accept`), sem o prefixo `me/team`.
 */
@Controller()
export class TeamInvitePublicController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * GET /public/team-invite/:token
   * Público (sem auth). Dados básicos para renderizar a página de convite
   * antes do usuário logar ou se cadastrar.
   */
  @Get('public/team-invite/:token')
  getPublicInvite(@Param('token') token: string) {
    return this.teamsService.getPublicInvite(token);
  }

  /**
   * POST /team-invite/:token/accept
   * Requer autenticação (o front redireciona para login/cadastro com
   * `?redirect=/convite/:token` antes de chamar isto).
   */
  @Post('team-invite/:token/accept')
  @UseGuards(JwtAuthGuard)
  acceptByToken(
    @Request() req: { user: User },
    @Param('token') token: string,
  ) {
    return this.teamsService.acceptInviteByToken(req.user, token);
  }
}
