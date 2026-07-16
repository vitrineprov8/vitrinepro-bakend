import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { UserSession } from '../auth/user-session.entity';
import { Vaga } from '../vagas/vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { PortfolioItem } from '../portfolio/portfolio.entity';
import { CV } from '../cv/cv.entity';
import { Education } from '../education/education.entity';
import { SavedVaga } from '../saved-vagas/saved-vaga.entity';
import { HunterCandidate } from '../hunter-candidates/hunter-candidate.entity';
import { Notification } from '../notifications/notification.entity';
import { Invoice } from '../invoices/invoice.entity';
import { Payout } from '../payouts/payout.entity';
import { TeamMember } from '../teams/team-member.entity';
import { HunterReview } from '../reviews/hunter-review.entity';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuditAction } from '../admin-audit-log/admin-audit-log.entity';
import { DeleteAccountDto } from './dto/delete-account.dto';

export interface SessionListItem {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  current: boolean;
}

/**
 * B26 — "Conta > Privacidade/Dados de acesso" (design-spec §C). Ações de
 * self-service do titular sobre a própria conta: sessões ativas, exportar
 * dados (LGPD) e excluir conta (anonimização, mesmo mecanismo do B24 admin,
 * mas disparado pelo próprio usuário — ver `UsersService.applyAnonymization`).
 */
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserSession)
    private sessionsRepository: Repository<UserSession>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    @InjectRepository(VagaApplication)
    private applicationsRepository: Repository<VagaApplication>,
    @InjectRepository(PortfolioItem)
    private portfolioRepository: Repository<PortfolioItem>,
    @InjectRepository(CV)
    private cvRepository: Repository<CV>,
    @InjectRepository(Education)
    private educationRepository: Repository<Education>,
    @InjectRepository(SavedVaga)
    private savedVagasRepository: Repository<SavedVaga>,
    @InjectRepository(HunterCandidate)
    private hunterCandidatesRepository: Repository<HunterCandidate>,
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(TeamMember)
    private teamMembersRepository: Repository<TeamMember>,
    @InjectRepository(HunterReview)
    private hunterReviewsRepository: Repository<HunterReview>,
    private usersService: UsersService,
    private adminAuditLogService: AdminAuditLogService,
  ) {}

  // ---------------------------------------------------------------------
  // Sessões ativas (Dados de acesso)
  // ---------------------------------------------------------------------

  async listSessions(userId: string, currentSessionId?: string): Promise<SessionListItem[]> {
    const sessions = await this.sessionsRepository.find({
      where: { userId, revokedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });

    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ revoked: true }> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada.');
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionsRepository.save(session);
    }
    return { revoked: true };
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionsRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ---------------------------------------------------------------------
  // Exportar meus dados (LGPD — Privacidade)
  // ---------------------------------------------------------------------

  /**
   * Reúne o que a conta possui nas tabelas mais relevantes. Cada categoria é
   * buscada isoladamente (uma falha numa não derruba as outras) — cobertura
   * de boa-fé, não um dump exaustivo de toda tabela que referencia userId
   * (ex.: histórico de auditoria administrativa não é "dado do titular").
   */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch {
        return fallback;
      }
    };

    const [
      vagasCriadas,
      candidaturas,
      indicacoesFeitas,
      portfolio,
      curriculos,
      formacao,
      vagasSalvas,
      candidatosNoPool,
      notificacoes,
      faturas,
      pagamentosRecebidos,
      timeMembros,
      avaliacoesRecebidas,
    ] = await Promise.all([
      safe(() => this.vagasRepository.find({ where: { createdById: userId } }), []),
      safe(() => this.applicationsRepository.find({ where: { userId } }), []),
      safe(() => this.applicationsRepository.find({ where: { submittedByHunterId: userId } }), []),
      safe(() => this.portfolioRepository.find({ where: { userId } }), []),
      safe(() => this.cvRepository.find({ where: { userId } }), []),
      safe(() => this.educationRepository.find({ where: { userId } }), []),
      safe(() => this.savedVagasRepository.find({ where: { userId } }), []),
      safe(() => this.hunterCandidatesRepository.find({ where: { hunterId: userId } }), []),
      safe(() => this.notificationsRepository.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 500 }), []),
      safe(() => this.invoicesRepository.find({ where: { companyId: userId } }), []),
      safe(() => this.payoutsRepository.find({ where: { hunterId: userId } }), []),
      safe(() => this.teamMembersRepository.find({ where: { userId } }), []),
      safe(() => this.hunterReviewsRepository.find({ where: { hunterId: userId } }), []),
    ]);

    return {
      exportadoEm: new Date().toISOString(),
      aviso:
        'Exportação de boa-fé dos principais dados vinculados à sua conta na VitrinePro (LGPD art. 18). ' +
        'Registros de auditoria administrativa e dados de terceiros (ex.: outra parte de uma candidatura) não são incluídos.',
      perfil: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
        bio: user.bio,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        isCompany: user.isCompany,
        companyName: user.companyName,
        companyIndustry: user.companyIndustry,
        personas: user.personas,
        plan: user.plan,
        planStatus: user.planStatus,
        hunterSpecialties: user.hunterSpecialties,
        hunterYearsExperience: user.hunterYearsExperience,
        verificationStatus: user.verificationStatus,
        referralCode: user.referralCode,
        createdAt: user.createdAt,
      },
      vagasCriadas,
      candidaturas,
      indicacoesFeitasComoHunter: indicacoesFeitas,
      portfolio,
      curriculos,
      formacao,
      vagasSalvas,
      candidatosNoPoolComoHunter: candidatosNoPool,
      notificacoes,
      faturasComoEmpresa: faturas,
      pagamentosRecebidosComoHunter: pagamentosRecebidos,
      participacoesEmTimes: timeMembros,
      avaliacoesRecebidasComoHunter: avaliacoesRecebidas,
    };
  }

  // ---------------------------------------------------------------------
  // Excluir conta (Privacidade) — anonimização self-service
  // ---------------------------------------------------------------------

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<{ id: string; anonymized: true }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Contas administradoras não podem se auto-excluir por aqui — fale com outro admin.',
      );
    }

    if (dto.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new BadRequestException('O e-mail digitado não corresponde ao e-mail da sua conta.');
    }

    this.usersService.applyAnonymization(user);
    const saved = await this.usersRepository.save(user);

    // Revoga tudo — inclusive a sessão que fez esta própria requisição (o
    // próximo request com esse token já cai em 401, forçando o front a
    // deslogar; ver AccountController.deleteAccount).
    await this.revokeAllSessions(userId);

    void this.adminAuditLogService.record({
      adminId: userId,
      action: AdminAuditAction.USER_SELF_ANONYMIZE,
      targetType: 'User',
      targetId: userId,
      reason: 'Autoexclusão de conta (LGPD, self-service via /app/conta).',
      payloadAfter: { anonymized: true },
    });

    return { id: saved.id, anonymized: true };
  }
}
