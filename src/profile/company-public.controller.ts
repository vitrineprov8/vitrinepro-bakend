import { Controller, Get, Param } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { VagasService } from '../vagas/vagas.service';

/**
 * B6 — Página pública de empresa (conta `isCompany`).
 *
 * Separado de `ProfileController` (prefixo `profile`) porque o path público
 * é `/empresas/:slug` (plano, sem prefixo) — mesmo padrão do
 * `TeamInvitePublicController`.
 */
@Controller()
export class CompanyPublicController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly vagasService: VagasService,
  ) {}

  /**
   * GET /empresas/:slug
   * Público (sem auth). `:slug` = `username` da conta empresa.
   * Retorna os dados públicos da empresa + vagas publicadas (vagasAbertas).
   */
  @Get('empresas/:slug')
  async getPublicCompany(@Param('slug') slug: string) {
    const company = await this.profileService.getPublicCompany(slug);
    const vagasAbertas = await this.vagasService.findPublicByOwner(company.id as string);
    return { ...company, vagasAbertas };
  }
}
