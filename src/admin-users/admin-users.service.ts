import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, PlanStatus } from '../users/user.entity';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserPlanDto } from './dto/update-user-plan.dto';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuditAction } from '../admin-audit-log/admin-audit-log.entity';
import { paginate, PaginatedResult } from '../common/paginate.helper';

/** Campos públicos/seguros de um usuário no painel admin (B24 — A6). Nunca inclui password/tokens. */
const ADMIN_USER_LIST_FIELDS = [
  'id',
  'email',
  'firstName',
  'lastName',
  'username',
  'role',
  'personas',
  'plan',
  'planStatus',
  'planExpiresAt',
  'isCompany',
  'companyName',
  'isActive',
  'createdAt',
] as const;

const LOGIN_AS_EXPIRES_IN = '15m';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private adminAuditLogService: AdminAuditLogService,
    private jwtService: JwtService,
  ) {}

  /** GET /admin/users — busca por nome/e-mail/persona/plano, paginado. */
  async list(query: QueryAdminUsersDto): Promise<PaginatedResult<Partial<User>>> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .select(ADMIN_USER_LIST_FIELDS.map((f) => `user.${f}`))
      .orderBy('user.createdAt', 'DESC');

    if (query.q) {
      qb.andWhere(
        '(LOWER(user.email) LIKE :q OR LOWER(user.firstName) LIKE :q OR LOWER(user.lastName) LIKE :q)',
        { q: `%${query.q.toLowerCase()}%` },
      );
    }
    if (query.persona) {
      // `personas` é simple-array (texto separado por vírgula) — mesmo padrão do B5 (hunters.service).
      qb.andWhere('user.personas LIKE :persona', { persona: `%${query.persona.toUpperCase()}%` });
    }
    if (query.plan) {
      qb.andWhere('user.plan = :plan', { plan: query.plan.toUpperCase() });
    }

    return paginate(qb, query.page, query.limit);
  }

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  /** PATCH /admin/users/:id/plan — altera plano manualmente, com motivo obrigatório. */
  async updatePlan(
    userId: string,
    adminId: string,
    dto: UpdateUserPlanDto,
  ): Promise<{ id: string; plan: string; planStatus: string }> {
    const user = await this.findUserOrFail(userId);
    const before = { plan: user.plan, planStatus: user.planStatus };

    user.plan = dto.plan;
    // Alteração manual pelo admin sempre ativa o plano (dá o benefício na hora,
    // independentemente de haver ou não uma assinatura/pagamento por trás).
    user.planStatus = PlanStatus.ACTIVE;
    const saved = await this.usersRepository.save(user);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.USER_PLAN_UPDATE,
      targetType: 'User',
      targetId: saved.id,
      reason: dto.reason,
      payloadBefore: before,
      payloadAfter: { plan: saved.plan, planStatus: saved.planStatus },
    });

    return { id: saved.id, plan: saved.plan, planStatus: saved.planStatus };
  }

  /** Promove um usuário a ADMIN. Motivo obrigatório — hoje só era possível via SQL direto. */
  async promoteToAdmin(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<{ id: string; role: UserRole }> {
    const user = await this.findUserOrFail(userId);
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Este usuário já é administrador.');
    }

    user.role = UserRole.ADMIN;
    const saved = await this.usersRepository.save(user);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.USER_PROMOTE_ADMIN,
      targetType: 'User',
      targetId: saved.id,
      reason,
      payloadBefore: { role: UserRole.USER },
      payloadAfter: { role: UserRole.ADMIN },
    });

    return { id: saved.id, role: saved.role };
  }

  /** Remove privilégio de ADMIN. Não permite que o admin se auto-remova (evita lockout acidental). */
  async demoteFromAdmin(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<{ id: string; role: UserRole }> {
    if (userId === adminId) {
      throw new BadRequestException(
        'Você não pode remover seu próprio acesso de administrador.',
      );
    }

    const user = await this.findUserOrFail(userId);
    if (user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Este usuário não é administrador.');
    }

    user.role = UserRole.USER;
    const saved = await this.usersRepository.save(user);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.USER_DEMOTE_ADMIN,
      targetType: 'User',
      targetId: saved.id,
      reason,
      payloadBefore: { role: UserRole.ADMIN },
      payloadAfter: { role: UserRole.USER },
    });

    return { id: saved.id, role: saved.role };
  }

  /**
   * POST /admin/users/:id/login-as — gera um token de suporte de curta duração
   * (15min) que autentica AS o usuário-alvo. Sempre auditado (motivo obrigatório).
   * Não permite impersonar outro ADMIN (superfície de ataque desnecessária).
   */
  async loginAs(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<{ accessToken: string; expiresIn: string; user: { id: string; email: string } }> {
    const target = await this.findUserOrFail(userId);
    if (target.role === UserRole.ADMIN) {
      throw new ForbiddenException('Não é permitido personificar outra conta administradora.');
    }

    const accessToken = this.jwtService.sign(
      { sub: target.id, email: target.email, role: target.role, impersonatedBy: adminId },
      { expiresIn: LOGIN_AS_EXPIRES_IN },
    );

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.USER_LOGIN_AS,
      targetType: 'User',
      targetId: target.id,
      reason,
      payloadAfter: { expiresIn: LOGIN_AS_EXPIRES_IN },
    });

    return {
      accessToken,
      expiresIn: LOGIN_AS_EXPIRES_IN,
      user: { id: target.id, email: target.email },
    };
  }

  /**
   * DELETE /admin/users/:id — anonimização LGPD (não é hard-delete: várias
   * tabelas referenciam userId por FK — vagas, placements, applications etc.
   * Excluir de verdade quebraria histórico/auditoria de terceiros). Escreve
   * dados aleatórios sobre os campos de PII e desativa a conta.
   */
  async anonymize(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<{ id: string; anonymized: true }> {
    if (userId === adminId) {
      throw new BadRequestException('Você não pode anonimizar sua própria conta por aqui.');
    }

    const user = await this.findUserOrFail(userId);
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Não é permitido anonimizar outra conta administradora.');
    }

    const stamp = Date.now();
    user.email = `anonimizado-${stamp}@removido.vitrinepro.com`;
    user.firstName = 'Usuário';
    user.lastName = 'Removido';
    user.password = null;
    user.authProvider = null;
    user.oauthId = null;
    user.avatarUrl = null;
    user.avatarKey = null;
    user.bannerUrl = null;
    user.bannerKey = null;
    user.username = null;
    user.profession = null;
    user.bio = null;
    user.phone = null;
    user.website = null;
    user.location = null;
    user.socialLinks = null;
    user.isActive = false;
    user.isVisible = false;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    user.emailVerificationToken = null;
    user.emailVerificationExpiresAt = null;
    user.verificationDocs = null;
    user.verificationLinkedinUrl = null;

    const saved = await this.usersRepository.save(user);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.USER_ANONYMIZE,
      targetType: 'User',
      targetId: saved.id,
      reason,
      payloadAfter: { anonymized: true },
    });

    return { id: saved.id, anonymized: true };
  }
}
