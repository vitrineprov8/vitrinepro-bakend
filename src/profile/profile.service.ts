import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserPersona } from '../users/user.entity';
import { Team } from '../teams/team.entity';
import { TeamMember, TeamMemberStatus } from '../teams/team-member.entity';
import { PortfolioItem, PortfolioStatus } from '../portfolio/portfolio.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetActiveContextDto } from './dto/set-active-context.dto';
import { StorageService } from '../storage/storage.service';
import { SeoService } from '../seo/seo.service';
import { TombstoneType, TombstoneReason } from '../seo/slug-tombstone.entity';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMembersRepository: Repository<TeamMember>,
    @InjectRepository(PortfolioItem)
    private portfolioRepository: Repository<PortfolioItem>,
    private storageService: StorageService,
    private seoService: SeoService,
  ) {}

  /**
   * B19 — remove campos sensíveis antes de devolver a entidade `User` crua.
   * `getPublicProfile`/`getPublicCompany` já faziam isso; os endpoints
   * autenticados (`/me`, `PATCH /profile`, `PATCH /profile/me/personas`,
   * upload de avatar/banner, active-context) não filtravam nada, vazando o
   * hash de `password` (e tokens de reset/verificação) para o front.
   */
  private sanitize(user: User): Omit<User, 'password' | 'passwordResetToken' | 'passwordResetExpiresAt'> {
    const { password, passwordResetToken, passwordResetExpiresAt, ...rest } = user as any;
    return rest;
  }

  async getMyProfile(userId: string): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.sanitize(user);
  }

  async getPublicProfile(username: string): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { username } });
    // Return 404 for missing users, hidden profiles, and company accounts
    // (avoids username enumeration; companies have no public profile page)
    if (!user || !user.isVisible || user.isCompany) {
      throw new NotFoundException('Perfil não encontrado.');
    }
    // Remover campos sensíveis antes de retornar
    const { password, oauthId, avatarKey, bannerKey, ...publicFields } = user as any;
    return publicFields;
  }

  /**
   * B6 — Página pública de empresa (conta `isCompany`).
   * Usa `username` como slug (mesmo mecanismo do perfil de candidato), mas
   * exige isCompany=true — o inverso de `getPublicProfile`. 404 para conta
   * inexistente, oculta, ou de candidato (evita enumeração de username).
   */
  async getPublicCompany(slug: string): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { username: slug } });
    if (!user || !user.isVisible || !user.isCompany) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    const { password, oauthId, avatarKey, bannerKey, ...publicFields } = user as any;
    return publicFields;
  }

  /**
   * B1 — Ativa uma persona adicional (CANDIDATO/HUNTER) na conta.
   *
   * Idempotente: se já ativa, apenas retorna o usuário sem alterar nada.
   * EMPRESA é bloqueada aqui — só é atribuída no registro (`isCompany=true`);
   * contas empresa não acumulam CANDIDATO/HUNTER por esta rota.
   */
  async activatePersona(userId: string, persona: UserPersona): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (persona === UserPersona.EMPRESA) {
      throw new ForbiddenException(
        'A persona EMPRESA não pode ser ativada por aqui — crie uma conta empresa.',
      );
    }
    if (user.isCompany) {
      throw new ForbiddenException('Contas empresa não podem ativar outras personas.');
    }

    const current = user.personas ?? [];
    if (current.includes(persona)) {
      return this.sanitize(user);
    }

    user.personas = [...current, persona];
    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  /**
   * Returns a lightweight paginated list of visible individual profiles for
   * consumption by the sitemap generator.
   *
   * Criteria:
   *   - isVisible = true
   *   - isCompany = false  (company accounts have no public profile page)
   *   - has a non-empty bio  OR  has at least one PUBLISHED portfolio item
   *
   * Only `username` and `updatedAt` are returned — the sitemap does not need
   * anything else, and avoiding a SELECT * keeps the payload tiny.
   *
   * Pagination: page/limit with a hard cap of 100 per page.
   */
  async getPublicList(
    page = 1,
    limit = 20,
  ): Promise<{ data: { username: string; updatedAt: Date }[]; total: number; page: number; lastPage: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    // Subquery: user ids that have at least one PUBLISHED portfolio item.
    const publishedSubQuery = this.portfolioRepository
      .createQueryBuilder('pi')
      .select('pi.userId')
      .where('pi.status = :status', { status: PortfolioStatus.PUBLISHED })
      .getQuery();

    const qb = this.usersRepository
      .createQueryBuilder('u')
      .select(['u.username', 'u.updatedAt'])
      .where('u.isVisible = true')
      .andWhere('u.isCompany = false')
      .andWhere('u.username IS NOT NULL')
      .andWhere(
        // Bio present  OR  has a published portfolio item (EXISTS subquery)
        `(
          (u.bio IS NOT NULL AND u.bio != '')
          OR u.id IN (${publishedSubQuery})
        )`,
      )
      .setParameter('status', PortfolioStatus.PUBLISHED)
      .orderBy('u.updatedAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((u) => ({ username: u.username as string, updatedAt: u.updatedAt })),
      total,
      page: safePage,
      lastPage: Math.ceil(total / safeLimit) || 1,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const oldUsername = user.username;
    const wasVisible = user.isVisible;

    if (dto.username && dto.username !== user.username) {
      const exists = await this.usersRepository.findOne({
        where: { username: dto.username },
      });
      if (exists) throw new ConflictException('Username já está em uso.');
    }

    Object.assign(user, dto);
    const savedUser = await this.usersRepository.save(user);

    // ── SEO tombstone side-effects (fire-and-forget, non-critical) ──────────

    const usernameChanged =
      dto.username !== undefined && dto.username !== oldUsername;
    const visibilityChanged =
      dto.isVisible !== undefined && dto.isVisible !== wasVisible;

    // Tombstones require a non-null username. Users registered via OAuth may
    // transiently have a null username before the onboarding step assigns one.
    if (usernameChanged && oldUsername && savedUser.username) {
      // Old username becomes a permanent redirect to the new one.
      this.seoService
        .createTombstone({
          type: TombstoneType.PROFILE,
          slug: oldUsername,
          reason: TombstoneReason.RENAMED,
          redirectTo: `/perfil/${savedUser.username}`,
        })
        .then(() =>
          // Remove any stale tombstone that might point at the new username
          // (edge case: user adopts a previously-tombstoned username).
          this.seoService.removeTombstone(
            TombstoneType.PROFILE,
            savedUser.username as string,
          ),
        )
        .catch((err) =>
          this.logger.error(
            `Failed to create renamed tombstone for profile "${oldUsername}" → "${savedUser.username}"`,
            err,
          ),
        );

      // Notify both old and new profile URLs so bots update their indexes fast.
      void this.seoService.notifyIndexNow([
        `/perfil/${oldUsername}`,
        `/perfil/${savedUser.username}`,
      ]);
    }

    if (visibilityChanged && savedUser.username) {
      if (!savedUser.isVisible) {
        // Profile was hidden — mark as 410 Gone.
        this.seoService
          .createTombstone({
            type: TombstoneType.PROFILE,
            slug: savedUser.username,
            reason: TombstoneReason.HIDDEN,
          })
          .catch((err) =>
            this.logger.error(
              `Failed to create hidden tombstone for profile "${savedUser.username}"`,
              err,
            ),
          );
      } else {
        // Profile became visible again — remove the tombstone so 404 lookup
        // returns { exists: false } and the frontend serves a normal 200.
        this.seoService
          .removeTombstone(TombstoneType.PROFILE, savedUser.username)
          .catch((err) =>
            this.logger.error(
              `Failed to remove tombstone for re-published profile "${savedUser.username}"`,
              err,
            ),
          );
      }

      // Notify IndexNow regardless of direction (hide or re-show) — either
      // way the bots need to re-crawl to update the index.
      void this.seoService.notifyIndexNow(`/perfil/${savedUser.username}`);
    }

    return this.sanitize(savedUser);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    this.storageService.validateImage(file.buffer, file.mimetype);

    if (user.avatarKey) {
      await this.storageService.deleteFile(user.avatarKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'avatar');
    const key = `avatars/${userId}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    user.avatarUrl = url;
    user.avatarKey = key;
    // T-E08 — contas empresa não têm um upload de "logo" dedicado; reusa este
    // mesmo endpoint (o widget de avatar no shell já é o que a Página da
    // Empresa chama de "logo"), preenchendo os dois campos: avatarUrl (usado
    // no shell/app.vue) e companyLogoUrl (usado só em /empresa/:slug, T10).
    if (user.isCompany) {
      user.companyLogoUrl = url;
    }
    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  /**
   * Sets or clears the active team context for the authenticated user.
   *
   * Rules:
   *  - teamId = null → switches to personal context (clears activeContextTeamId).
   *  - teamId = UUID  → the user must be the OWNER of that team OR an ACTIVE member.
   *
   * Persists activeContextTeamId on the User row. The frontend uses this to
   * show "Publicando como: Empresa X" in VagaEditor, and the vagas service
   * reads it when creating vagas to derive owner/companyId from the team.
   */
  async setActiveContext(userId: string, dto: SetActiveContextDto): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (dto.teamId === null || dto.teamId === undefined) {
      // Reset to personal context
      user.activeContextTeamId = null;
      const saved = await this.usersRepository.save(user);
      return this.sanitize(saved);
    }

    // Validate the user owns or belongs to this team
    const team = await this.teamsRepository.findOne({
      where: { id: dto.teamId },
      select: ['id', 'ownerId'],
    });

    if (!team) {
      throw new NotFoundException('Time não encontrado.');
    }

    const isOwner = team.ownerId === userId;

    if (!isOwner) {
      // Check active membership
      const membership = await this.teamMembersRepository.findOne({
        where: {
          teamId: dto.teamId,
          userId,
          status: TeamMemberStatus.ACTIVE,
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'Você não é membro ativo deste time.',
        );
      }
    }

    user.activeContextTeamId = dto.teamId;
    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }

  async uploadBanner(userId: string, file: Express.Multer.File): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    this.storageService.validateImage(file.buffer, file.mimetype);

    if (user.bannerKey) {
      await this.storageService.deleteFile(user.bannerKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'banner');
    const key = `banners/${userId}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    user.bannerUrl = url;
    user.bannerKey = key;
    const saved = await this.usersRepository.save(user);
    return this.sanitize(saved);
  }
}
