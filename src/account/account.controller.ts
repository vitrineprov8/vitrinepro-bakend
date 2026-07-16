import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountService } from './account.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

/**
 * B26 — self-service do titular sobre a própria conta (design-spec §C):
 * sessões ativas ("Dados de acesso"), exportar dados e excluir conta
 * ("Privacidade"). Tudo autenticado — nunca opera sobre outro usuário.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('sessions')
  listSessions(@Request() req: { user: { id: string; sessionId?: string } }) {
    return this.accountService.listSessions(req.user.id, req.user.sessionId);
  }

  @Delete('sessions/:id')
  revokeSession(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.accountService.revokeSession(req.user.id, id);
  }

  @Get('account/export')
  exportData(@Request() req: { user: { id: string } }) {
    return this.accountService.exportData(req.user.id);
  }

  @Delete('account')
  deleteAccount(
    @Request() req: { user: { id: string } },
    @Body() dto: DeleteAccountDto,
  ) {
    return this.accountService.deleteAccount(req.user.id, dto);
  }
}
