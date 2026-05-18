import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import slugify from 'slugify';
import { Vaga, VagaStatus } from './vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { User, UserRole, PlanTier, PlanStatus } from '../users/user.entity';
import { VagaPublishLedger } from '../vaga-publish-ledger/vaga-publish-ledger.entity';
import { getCurrentCycle } from '../vaga-publish-ledger/cycle.util';
import { PLAN_VAGA_LIMITS } from '../plans/plan-limits';
import { Company } from '../companies/company.entity';
import { TeamMember, TeamMemberStatus, TeamRole } from '../teams/team-member.entity';
import { TeamContextHelper } from '../teams/team-context.helper';
import { CreateVagaDto } from './dto/create-vaga.dto';
import { UpdateVagaDto } from './dto/update-vaga.dto';
import { ListVagasDto } from './dto/list-vagas.dto';
import { paginate, PaginatedResult } from '../common/paginate.helper';

type VagaWithCount = Vaga & { applicationsCount: number };

@Injectable()
export class VagasService {
  constructor(
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    @InjectRepository(VagaApplication)
    private vagaApplicationsRepository: Repository<VagaApplication>,
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    @InjectRepository(TeamMember)
    private teamMembersRepository: Repository<TeamMember>,
    @InjectDataSource()
    private dataSource: DataSource,
    private teamContextHelper: TeamContextHelper,
  ) {}

  private async attachApplicationsCount(
    result: PaginatedResult<Vaga>,
  ): Promise<PaginatedResult<VagaWithCount>> {
    if (result.data.length === 0) {
      return { ...result, data: [] };
    }
    const ids = result.data.map((v) => v.id);
    const rows = await this.vagaApplicationsRepository
      .createQueryBuilder('app')
      .select('app.vagaId', 'vagaId')
      .addSelect('COUNT(*)', 'count')
      .where('app.vagaId IN (:...ids)', { ids })
      .groupBy('app.vagaId')
      .getRawMany<{ vagaId: string; count: string }>();
    const counts = new Map(rows.map((r) => [r.vagaId, parseInt(r.count, 10)]));
    return {
      ...result,
      data: result.data.map((v) => ({
        ...v,
        applicationsCount: counts.get(v.id) ?? 0,
      })) as VagaWithCount[],
    };
  }

  async listPublic(dto: ListVagasDto) {
    const { page = 1, limit = 10, q, type, workMode } = dto;

    const qb = this.vagasRepository
      .createQueryBuilder('vaga')
      .where('vaga.status = :status', { status: VagaStatus.PUBLISHED })
      .andWhere('(vaga.deadline IS NULL OR vaga.deadline > NOW())')
      .orderBy('vaga.createdAt', 'DESC');

    if (q) {
      qb.andWhere(
        '(LOWER(vaga.title) LIKE :q OR LOWER(vaga.description) LIKE :q)',
        { q: `%${q.toLowerCase()}%` },
      );
    }
    if (type) qb.andWhere('vaga.type = :type', { type });
    if (workMode) qb.andWhere('vaga.workMode = :workMode', { workMode });

    return paginate(qb, page, limit);
  }

  /**
   * Lists vagas visible to the authenticated user.
   *
   * - OWNER:   all vagas created by anyone in their team (owner + all members).
   * - MANAGER: same — all vagas in the owner's team scope.
   * - RECRUITER: same team-wide scope (no filtering by assignment here;
   *              assignment filtering applies to companies, not vaga listing).
   * - Solo user: only their own vagas.
   */
  async listMine(user: User, dto: ListVagasDto) {
    const { page = 1, limit = 10, q, status, type, workMode } = dto;

    const ctx = await this.teamContextHelper.getTeamContext(user);
    const ownerId = ctx.quotaOwner.id;

    // Collect all userIds in scope: the quota owner's team (owner + active members)
    const teamUserIds = await this.teamContextHelper.getTeamUserIds(ownerId);

    const qb = this.vagasRepository
      .createQueryBuilder('vaga')
      .where('vaga.createdById IN (:...userIds)', { userIds: teamUserIds })
      .orderBy('vaga.createdAt', 'DESC');

    if (status) qb.andWhere('vaga.status = :status', { status });
    if (q) {
      qb.andWhere('LOWER(vaga.title) LIKE :q', {
        q: `%${q.toLowerCase()}%`,
      });
    }
    if (type) qb.andWhere('vaga.type = :type', { type });
    if (workMode) qb.andWhere('vaga.workMode = :workMode', { workMode });

    const result = await paginate(qb, page, limit);
    return this.attachApplicationsCount(result);
  }

  /** Admin-only: lists all vagas in the system */
  async listAdmin(dto: ListVagasDto) {
    const { page = 1, limit = 10, q, status, type, workMode } = dto;

    const qb = this.vagasRepository
      .createQueryBuilder('vaga')
      .orderBy('vaga.createdAt', 'DESC');

    if (status) qb.andWhere('vaga.status = :status', { status });
    if (q) {
      qb.andWhere('LOWER(vaga.title) LIKE :q', {
        q: `%${q.toLowerCase()}%`,
      });
    }
    if (type) qb.andWhere('vaga.type = :type', { type });
    if (workMode) qb.andWhere('vaga.workMode = :workMode', { workMode });

    return paginate(qb, page, limit);
  }

  async findBySlugPublic(slug: string): Promise<Vaga> {
    const vaga = await this.vagasRepository.findOne({ where: { slug } });
    if (!vaga || vaga.status !== VagaStatus.PUBLISHED) {
      throw new NotFoundException('Vaga não encontrada.');
    }
    if (vaga.deadline && vaga.deadline < new Date()) {
      throw new NotFoundException('Vaga não disponível.');
    }
    return vaga;
  }

  async findById(id: string): Promise<Vaga> {
    const vaga = await this.vagasRepository.findOne({ where: { id } });
    if (!vaga) throw new NotFoundException('Vaga não encontrada.');
    return vaga;
  }

  /**
   * Creates a new vaga for the user.
   *
   * Status is ALWAYS forced to DRAFT server-side — creating a draft is free
   * and does not consume any plan slot. Publication must happen via
   * POST /vagas/:id/publish.
   *
   * Company validation: the company must belong to the QUOTA OWNER (the team
   * owner), not necessarily to the actor directly. This allows MANAGER and
   * RECRUITER to attach the owner's companies to their vagas.
   */
  async create(user: User, dto: CreateVagaDto): Promise<Vaga> {
    const ctx = await this.teamContextHelper.getTeamContext(user);
    const quotaOwner = ctx.quotaOwner;

    const slug = await this.generateUniqueSlug(dto.title);

    // Validate companyId — must belong to the quota owner's scope
    let resolvedCompanyId: string | null = null;
    if (dto.companyId) {
      const company = await this.companiesRepository.findOne({
        where: { id: dto.companyId },
        select: ['id', 'ownerId'],
      });
      if (!company || company.ownerId !== quotaOwner.id) {
        throw new ForbiddenException('Empresa não encontrada ou não pertence ao time.');
      }
      // Company plans check against the quota owner's plan
      const ownerPlan = quotaOwner.plan;
      if (ownerPlan !== PlanTier.TEAM && ownerPlan !== PlanTier.ENTERPRISE) {
        throw new ForbiddenException(
          'Associar uma empresa a uma vaga requer plano Team ou Enterprise.',
        );
      }
      resolvedCompanyId = dto.companyId;
    }

    const vaga = this.vagasRepository.create({
      title: dto.title,
      slug,
      description: dto.description,
      requirements: dto.requirements ?? null,
      benefits: dto.benefits ?? null,
      location: dto.location ?? null,
      type: dto.type ?? null,
      workMode: dto.workMode ?? null,
      salaryMin: dto.salaryMin ?? null,
      salaryMax: dto.salaryMax ?? null,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      // Force DRAFT regardless of what the client sends.  Publication
      // requires an explicit POST /vagas/:id/publish call.
      status: VagaStatus.DRAFT,
      publishedAt: null,
      contactEmail: dto.contactEmail ?? null,
      // Author is always the actual actor — quota owner is only for billing
      createdById: user.id,
      companyId: resolvedCompanyId,
    });

    return this.vagasRepository.save(vaga);
  }

  /**
   * Updates a vaga's editable fields.
   *
   * PUBLISHED is rejected here — use POST /vagas/:id/publish to publish.
   * Allows transitioning between DRAFT and CLOSED (e.g. archiving a draft).
   *
   * Authorization: owner of the vaga OR admin OR OWNER/MANAGER in the same team.
   */
  async update(
    id: string,
    dto: UpdateVagaDto,
    actor: User,
  ): Promise<Vaga> {
    const vaga = await this.findById(id);
    await this.assertVagaAccess(vaga, actor);

    // Prevent direct status change to PUBLISHED via PATCH — must use publish endpoint
    if (dto.status === VagaStatus.PUBLISHED) {
      throw new BadRequestException(
        'Não é permitido publicar uma vaga via PATCH. Use POST /vagas/:id/publish.',
      );
    }

    if (dto.title && dto.title !== vaga.title) {
      vaga.slug = await this.generateUniqueSlug(dto.title, id);
    }

    // Validate companyId if provided — against the quota owner's companies
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    const quotaOwner = ctx.quotaOwner;

    let resolvedCompanyId = vaga.companyId;
    if (dto.companyId !== undefined) {
      if (dto.companyId === null) {
        resolvedCompanyId = null;
      } else {
        const company = await this.companiesRepository.findOne({
          where: { id: dto.companyId },
          select: ['id', 'ownerId'],
        });
        if (!company || company.ownerId !== quotaOwner.id) {
          throw new ForbiddenException('Empresa não encontrada ou não pertence ao time.');
        }
        if (quotaOwner.plan !== PlanTier.TEAM && quotaOwner.plan !== PlanTier.ENTERPRISE) {
          throw new ForbiddenException(
            'Associar uma empresa a uma vaga requer plano Team ou Enterprise.',
          );
        }
        resolvedCompanyId = dto.companyId;
      }
    }

    Object.assign(vaga, {
      title: dto.title ?? vaga.title,
      description: dto.description ?? vaga.description,
      requirements: dto.requirements !== undefined ? dto.requirements : vaga.requirements,
      benefits: dto.benefits !== undefined ? dto.benefits : vaga.benefits,
      location: dto.location !== undefined ? dto.location : vaga.location,
      type: dto.type !== undefined ? dto.type : vaga.type,
      workMode: dto.workMode !== undefined ? dto.workMode : vaga.workMode,
      salaryMin: dto.salaryMin !== undefined ? dto.salaryMin : vaga.salaryMin,
      salaryMax: dto.salaryMax !== undefined ? dto.salaryMax : vaga.salaryMax,
      deadline: dto.deadline !== undefined
        ? (dto.deadline ? new Date(dto.deadline) : null)
        : vaga.deadline,
      // Only allow DRAFT or CLOSED via PATCH (PUBLISHED is blocked above)
      status: dto.status ?? vaga.status,
      contactEmail: dto.contactEmail !== undefined ? dto.contactEmail : vaga.contactEmail,
      companyId: resolvedCompanyId,
    });

    return this.vagasRepository.save(vaga);
  }

  /**
   * Assigns a team member (or clears the assignment) to a vaga.
   *
   * Rules:
   *   - Vaga must belong to the actor OR the actor must be OWNER/MANAGER in the
   *     same team that owns the vaga creator.
   *   - If userId is non-null, the target user must be an ACTIVE member of that team.
   */
  async assign(
    vagaId: string,
    actorId: string,
    actorRole: UserRole,
    targetUserId: string | null,
  ): Promise<Vaga> {
    const vaga = await this.findById(vagaId);

    // Determine ownership — admin bypasses all checks
    if (actorRole !== UserRole.ADMIN) {
      if (vaga.createdById !== actorId) {
        // Actor is not the direct owner — check if they are OWNER/MANAGER in the
        // team that the vaga creator belongs to (team-level delegation).
        const actorMembership = await this.teamMembersRepository
          .createQueryBuilder('tm')
          .innerJoin('tm.team', 'team', 'team.ownerId = :vagaOwnerId', {
            vagaOwnerId: vaga.createdById,
          })
          .where('tm.userId = :actorId', { actorId })
          .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
          .andWhere("tm.role IN ('OWNER', 'MANAGER')")
          .getOne();

        if (!actorMembership) {
          throw new ForbiddenException(
            'Você não tem permissão para atribuir responsável nesta vaga.',
          );
        }
      }
    }

    if (targetUserId !== null) {
      // Verify the target user is an ACTIVE member of the relevant team
      const vagaOwnerId = vaga.createdById;
      const membership = await this.teamMembersRepository
        .createQueryBuilder('tm')
        .innerJoin('tm.team', 'team', 'team.ownerId = :vagaOwnerId', {
          vagaOwnerId,
        })
        .where('tm.userId = :targetUserId', { targetUserId })
        .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
        .getOne();

      if (!membership) {
        throw new ForbiddenException(
          'O usuário não é membro ativo do time associado a esta vaga.',
        );
      }
    }

    vaga.assignedToId = targetUserId;
    return this.vagasRepository.save(vaga);
  }

  /**
   * Publishes a vaga.
   *
   * Atomically:
   *   1. Validates authorization (owner, team member, or admin).
   *   2. Checks the plan limit against the ledger for the QUOTA OWNER's current
   *      cycle — not the actor's cycle. This ensures MANAGER/RECRUITER consume
   *      slots from the team owner's quota.
   *   3. Records the publish in the ledger under the QUOTA OWNER's userId.
   *   4. Sets vaga.status = PUBLISHED and vaga.publishedAt (first publish only).
   *
   * Throws:
   *   - 404 if vaga does not exist
   *   - 403 if actor is not authorized
   *   - 409 if vaga is already PUBLISHED
   *   - 403 with code PLAN_LIMIT_REACHED if limit exceeded
   */
  async publish(vagaId: string, actor: User): Promise<Vaga> {
    return this.dataSource.transaction(async (manager) => {
      const vaga = await manager.findOne(Vaga, { where: { id: vagaId } });
      if (!vaga) throw new NotFoundException('Vaga não encontrada.');

      // Authorization check (admin bypasses)
      if (actor.role !== UserRole.ADMIN) {
        await this.assertVagaAccessInTransaction(vaga, actor, manager);
      }

      if (vaga.status === VagaStatus.PUBLISHED) {
        throw new ConflictException('Vaga já está publicada.');
      }

      // Admins bypass the plan limit
      if (actor.role !== UserRole.ADMIN) {
        // Resolve the quota owner within the transaction for accuracy
        const ctx = await this.teamContextHelper.getTeamContext(actor);
        const quotaOwner = ctx.quotaOwner;

        // Fetch fresh quota owner to get up-to-date plan info
        const freshOwner = await manager.findOne(User, {
          where: { id: quotaOwner.id },
          select: ['id', 'plan', 'planStatus', 'planExpiresAt', 'role'],
        });
        if (!freshOwner) throw new NotFoundException('Usuário não encontrado.');

        const now = new Date();
        const isSubscriptionActive =
          freshOwner.planStatus === PlanStatus.ACTIVE &&
          freshOwner.planExpiresAt !== null &&
          freshOwner.planExpiresAt > now;

        const effectivePlan: PlanTier = isSubscriptionActive
          ? freshOwner.plan
          : PlanTier.FREE;
        const limit = PLAN_VAGA_LIMITS[effectivePlan];

        if (limit !== -1) {
          const cycle = getCurrentCycle(freshOwner);

          // Count used slots for the QUOTA OWNER within this transaction
          const used = await manager
            .getRepository(VagaPublishLedger)
            .createQueryBuilder('ledger')
            .where('ledger."userId" = :userId', { userId: freshOwner.id })
            .andWhere('ledger."cycleStart" = :cycleStart', { cycleStart: cycle.start })
            .getCount();

          if (used >= limit) {
            throw new ForbiddenException({
              code: 'PLAN_LIMIT_REACHED',
              used,
              limit,
              cycleEnd: cycle.end,
              message:
                'O time atingiu o limite de vagas publicadas neste ciclo. Faça upgrade para continuar.',
            });
          }

          // Record publish under the QUOTA OWNER's userId — idempotent via ON CONFLICT DO NOTHING
          await manager
            .getRepository(VagaPublishLedger)
            .createQueryBuilder()
            .insert()
            .into(VagaPublishLedger)
            .values({
              userId: freshOwner.id,
              vagaId: vaga.id,
              cycleStart: cycle.start,
              cycleEnd: cycle.end,
            })
            .orIgnore()
            .execute();
        }
      }

      vaga.status = VagaStatus.PUBLISHED;
      // Only set publishedAt on first publish; preserve the original timestamp on re-publish
      if (!vaga.publishedAt) {
        vaga.publishedAt = new Date();
      }

      return manager.save(Vaga, vaga);
    });
  }

  /**
   * Unpublishes (closes) a vaga.
   *
   * Sets status to CLOSED.  Does NOT refund the consumed slot in the ledger —
   * the slot is irreversibly spent for this billing cycle.
   */
  async unpublish(vagaId: string, actor: User): Promise<Vaga> {
    const vaga = await this.findById(vagaId);
    await this.assertVagaAccess(vaga, actor);

    if (vaga.status !== VagaStatus.PUBLISHED) {
      throw new BadRequestException('Apenas vagas publicadas podem ser encerradas.');
    }

    vaga.status = VagaStatus.CLOSED;
    return this.vagasRepository.save(vaga);
  }

  async remove(id: string, actor: User): Promise<void> {
    const vaga = await this.findById(id);
    await this.assertVagaAccess(vaga, actor);
    // Ledger rows are NOT deleted — the FK is SET NULL, preserving the consumed slot
    await this.vagasRepository.remove(vaga);
  }

  /**
   * Checks whether the actor is authorized to mutate the given vaga.
   *
   * Authorization is granted when ANY of the following is true:
   *  1. actor.role === ADMIN
   *  2. vaga.createdById === actor.id  (direct author)
   *  3. actor is an ACTIVE OWNER or MANAGER in the team whose owner created the vaga
   *     (team-level delegation for cross-member vaga management)
   *
   * Throws ForbiddenException otherwise.
   */
  private async assertVagaAccess(vaga: Vaga, actor: User): Promise<void> {
    if (actor.role === UserRole.ADMIN) return;
    if (vaga.createdById === actor.id) return;

    // Check team-level access: actor must be OWNER or MANAGER in the team
    // whose owner authored this vaga
    const teamAccess = await this.teamMembersRepository
      .createQueryBuilder('tm')
      .innerJoin('tm.team', 'team', 'team.ownerId = :vagaCreatorId', {
        vagaCreatorId: vaga.createdById,
      })
      .where('tm.userId = :actorId', { actorId: actor.id })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .andWhere("tm.role IN ('OWNER', 'MANAGER')")
      .getOne();

    // Also allow: vaga was created by a team member, and actor is the team OWNER
    const ownerAccess = await this.teamMembersRepository
      .createQueryBuilder('tm')
      .innerJoin('tm.team', 'team', 'team.ownerId = :actorId', {
        actorId: actor.id,
      })
      .where('tm.userId = :vagaCreatorId', { vagaCreatorId: vaga.createdById })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .getOne();

    if (!teamAccess && !ownerAccess) {
      throw new ForbiddenException('Você não tem permissão para modificar esta vaga.');
    }
  }

  /**
   * Same as assertVagaAccess but runs inside an existing transaction manager.
   * Used within VagasService.publish() to avoid opening a nested transaction.
   */
  private async assertVagaAccessInTransaction(
    vaga: Vaga,
    actor: User,
    manager: import('typeorm').EntityManager,
  ): Promise<void> {
    if (actor.role === UserRole.ADMIN) return;
    if (vaga.createdById === actor.id) return;

    const tmRepo = manager.getRepository(TeamMember);

    const teamAccess = await tmRepo
      .createQueryBuilder('tm')
      .innerJoin('tm.team', 'team', 'team.ownerId = :vagaCreatorId', {
        vagaCreatorId: vaga.createdById,
      })
      .where('tm.userId = :actorId', { actorId: actor.id })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .andWhere("tm.role IN ('OWNER', 'MANAGER')")
      .getOne();

    const ownerAccess = await tmRepo
      .createQueryBuilder('tm')
      .innerJoin('tm.team', 'team', 'team.ownerId = :actorId', {
        actorId: actor.id,
      })
      .where('tm.userId = :vagaCreatorId', { vagaCreatorId: vaga.createdById })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .getOne();

    if (!teamAccess && !ownerAccess) {
      throw new ForbiddenException('Você não tem permissão para modificar esta vaga.');
    }
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 2;

    while (true) {
      const qb = this.vagasRepository
        .createQueryBuilder('vaga')
        .where('vaga.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('vaga.id != :id', { id: excludeId });
      }
      const existing = await qb.getOne();
      if (!existing) break;
      slug = `${base}-${counter++}`;
    }

    return slug;
  }
}
