import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { VagasService } from './vagas.service';
import { AdminUnpublishVagaDto } from './dto/admin-unpublish-vaga.dto';

/**
 * B24 (A6) — moderação admin de vagas. Rota separada de `VagasController`
 * (que usa o prefixo `vagas`) para expor `/admin/vagas/...` no nível raiz,
 * mesmo padrão de `/admin/empresas` (B22) e `/admin/hunters/...` (B8).
 */
@Controller('admin/vagas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminVagasController {
  constructor(private readonly vagasService: VagasService) {}

  @Post(':id/unpublish')
  adminUnpublish(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: AdminUnpublishVagaDto,
  ) {
    return this.vagasService.adminUnpublish(id, req.user.id, dto.reason);
  }
}
