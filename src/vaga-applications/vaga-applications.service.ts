import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VagaApplication, ApplicationSource } from './vaga-application.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';
import { User, UserRole } from '../users/user.entity';
import { PipelineTemplate } from '../pipeline-templates/pipeline-template.entity';
import { TeamContextHelper } from '../teams/team-context.helper';
import { ApplyDto } from './dto/apply.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateGeneralDto } from './dto/update-general.dto';
import { UpdateStageNotesDto } from './dto/update-stage-notes.dto';
import { ListOwnerApplicationsDto } from './dto/list-owner-applications.dto';
import { ListTeamApplicationsDto } from './dto/list-team-applications.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { paginate } from '../common/paginate.helper';

@Injectable()
export class VagaApplicationsService {
  constructor(
    @InjectRepository(VagaApplication)
    private applicationsRepository: Repository<VagaApplication>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    @InjectRepository(CV)
    private cvRepository: Repository<CV>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(PipelineTemplate)
    private pipelineTemplatesRepository: Repository<PipelineTemplate>,
    private teamContextHelper: TeamContextHelper,
    private notificationsService: NotificationsService,
  ) {}

  private async assertCanManageVaga(
    vagaCreatedById: string | null,
    actorId: string,
    actorRole: UserRole,
    forbiddenMessage: string,
  ): Promise<void> {
    if (actorRole === UserRole.ADMIN) return;
    if (vagaCreatedById === actorId) return;

    const isTeamLead =
      !!vagaCreatedById &&
      (await this.teamContextHelper.canManageAsTeamLead(vagaCreatedById, actorId));
    if (isTeamLead) return;

    throw new ForbiddenException(forbiddenMessage);
  }

  async apply(
    userId: string,
    slug: string,
    dto: ApplyDto,
  ): Promise<VagaApplication> {
    const vaga = await this.vagasRepository.findOne({ where: { slug } });
    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    if (vaga.status !== VagaStatus.PUBLISHED) {
      throw new BadRequestException('Esta vaga não está aberta para candidaturas.');
    }
    if (vaga.deadline && vaga.deadline < new Date()) {
      throw new BadRequestException('O prazo desta vaga já encerrou.');
    }

    const existing = await this.applicationsRepository.findOne({
      where: { vagaId: vaga.id, userId },
    });
    if (existing) {
      throw new ConflictException('Você já se candidatou a esta vaga.');
    }

    if (dto.cvId) {
      const cv = await this.cvRepository.findOne({ where: { id: dto.cvId } });
      if (!cv) throw new NotFoundException('Currículo não encontrado.');
      if (cv.userId !== userId) {
        throw new ForbiddenException('Currículo inválido.');
      }
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (user.isCompany) {
      throw new ForbiddenException(
        'Contas empresariais não podem se candidatar a vagas. Use uma conta de profissional.',
      );
    }

    const profileUpdates: Partial<User> = {};
    if (!user.phone && dto.phone) profileUpdates.phone = dto.phone;
    if (!user.location && dto.location) profileUpdates.location = dto.location;
    if (!user.firstName && !user.lastName && dto.fullName) {
      const [first, ...rest] = dto.fullName.trim().split(/\s+/);
      profileUpdates.firstName = first;
      profileUpdates.lastName = rest.join(' ') || '';
    }
    if (Object.keys(profileUpdates).length > 0) {
      await this.usersRepository.update(userId, profileUpdates);
    }

    const application = this.applicationsRepository.create({
      vagaId: vaga.id,
      userId,
      cvId: dto.cvId ?? null,
      message: dto.message ?? null,
      snapshotFullName: dto.fullName,
      snapshotEmail: dto.email,
      snapshotPhone: dto.phone ?? null,
      snapshotLocation: dto.location ?? null,
      pipelineStage: 'para_analisar',
      isRejected: false,
    });

    return this.applicationsRepository.save(application);
  }

  async listMine(userId: string): Promise<unknown[]> {
    const apps = await this.applicationsRepository.find({
      where: { userId },
      relations: ['vaga'],
      order: { createdAt: 'DESC' },
    });

    return apps.map((a) => ({
      id: a.id,
      pipelineStage: a.pipelineStage,
      isRejected: a.isRejected,
      message: a.message,
      createdAt: a.createdAt,
      vaga: a.vaga
        ? {
            id: a.vaga.id,
            slug: a.vaga.slug,
            title: a.vaga.title,
            status: a.vaga.status,
            location: a.vaga.location,
            type: a.vaga.type,
            workMode: a.vaga.workMode,
          }
        : null,
    }));
  }

  async listByVaga(
    vagaId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<unknown[]> {
    const vaga = await this.vagasRepository.findOne({ where: { id: vagaId } });
    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    await this.assertCanManageVaga(
      vaga.createdById,
      actorId,
      actorRole,
      'Você não tem permissão para ver as candidaturas desta vaga.',
    );

    const apps = await this.applicationsRepository.find({
      where: { vagaId },
      relations: ['user', 'cv'],
      order: { createdAt: 'DESC' },
    });

    const hasHunterApp = apps.some((a) => a.source === ApplicationSource.HUNTER);
    let revealThreshold = 2;
    let stageOrderById = new Map<string, number>();
    if (hasHunterApp) {
      const owner = await this.usersRepository.findOne({
        where: { id: vaga.createdById as string },
        select: ['id', 'hunterContactRevealStageOrder'],
      });
      revealThreshold = owner?.hunterContactRevealStageOrder ?? 2;

      const template = await this.pipelineTemplatesRepository.findOne({
        where: { ownerId: vaga.createdById as string },
      });
      stageOrderById = new Map(
        (template?.stages ?? []).map((s) => [s.id, s.order]),
      );
    }

    return apps.map((a) => {
      const isHunterSourced = a.source === ApplicationSource.HUNTER;
      const stageOrder = stageOrderById.get(a.pipelineStage) ?? 0;
      const contactMasked = isHunterSourced && stageOrder < revealThreshold;

      return {
        id: a.id,
        source: a.source,
        pipelineStage: a.pipelineStage,
        isRejected: a.isRejected,
        message: a.message,
        snapshotFullName: a.snapshotFullName,
        snapshotEmail: contactMasked ? null : a.snapshotEmail,
        snapshotPhone: contactMasked ? null : a.snapshotPhone,
        snapshotLocation: a.snapshotLocation,
        contactMasked,
        generalScore: a.generalScore,
        generalNote: a.generalNote,
        stageNotes: a.stageNotes,
        createdAt: a.createdAt,
        cv: a.cv
          ? { id: a.cv.id, label: a.cv.label, fileUrl: a.cv.fileUrl }
          : null,
        user: a.user
          ? {
              id: a.user.id,
              firstName: a.user.firstName,
              lastName: a.user.lastName,
              username: a.user.username,
              avatarUrl: a.user.avatarUrl,
            }
          : null,
      };
    });
  }

  /**
   * T-E05 — Empresa: "Candidatos" (tabela plana de candidaturas de TODAS as
   * vagas do dono, com filtros). Reusa a mesma lógica de mascaramento de
   * contato do listByVaga, mas agregando por dono em vez de por vaga única.
   *
   * Escopo: só vagas com `createdById = actorId` (contas empresa não usam
   * delegação de time como o B15 — isso é hunter-only por enquanto).
   */
  private async resolveOwnerScope(
    actorId: string,
    dto: ListOwnerApplicationsDto,
  ): Promise<{ vagaIds: string[]; stageOrderById: Map<string, number>; revealThreshold: number }> {
    const ownedVagas = await this.vagasRepository.find({
      where: { createdById: actorId },
      select: ['id'],
    });
    let vagaIds = ownedVagas.map((v) => v.id);

    if (dto.vagaId) {
      if (!vagaIds.includes(dto.vagaId)) {
        throw new ForbiddenException(
          'Você não tem permissão para ver as candidaturas desta vaga.',
        );
      }
      vagaIds = [dto.vagaId];
    }

    const owner = await this.usersRepository.findOne({
      where: { id: actorId },
      select: ['id', 'hunterContactRevealStageOrder'],
    });
    const template = await this.pipelineTemplatesRepository.findOne({
      where: { ownerId: actorId },
    });
    const stageOrderById = new Map(
      (template?.stages ?? []).map((s) => [s.id, s.order]),
    );

    return {
      vagaIds,
      stageOrderById,
      revealThreshold: owner?.hunterContactRevealStageOrder ?? 2,
    };
  }

  async listByOwner(
    actorId: string,
    dto: ListOwnerApplicationsDto,
  ): Promise<unknown> {
    const { vagaIds, stageOrderById, revealThreshold } =
      await this.resolveOwnerScope(actorId, dto);

    if (vagaIds.length === 0) {
      return { data: [], total: 0, page: 1, lastPage: 0 };
    }

    const qb = this.applicationsRepository
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.vaga', 'vaga')
      .where('app.vagaId IN (:...vagaIds)', { vagaIds })
      .orderBy('app.createdAt', 'DESC');

    if (dto.pipelineStage) {
      qb.andWhere('app.pipelineStage = :pipelineStage', {
        pipelineStage: dto.pipelineStage,
      });
    }
    if (dto.source) {
      qb.andWhere('app.source = :source', { source: dto.source });
    }
    if (dto.isRejected !== undefined) {
      qb.andWhere('app.isRejected = :isRejected', {
        isRejected: dto.isRejected,
      });
    }
    if (dto.q) {
      qb.andWhere('LOWER(app.snapshotFullName) LIKE :q', {
        q: `%${dto.q.toLowerCase()}%`,
      });
    }

    const result = await paginate(qb, dto.page, dto.limit);

    return {
      ...result,
      data: result.data.map((a) =>
        this.serializeOwnerApplication(a, stageOrderById, revealThreshold),
      ),
    };
  }

  /** Same filters as listByOwner, but no pagination — feeds CSV export. */
  async listByOwnerForExport(
    actorId: string,
    dto: ListOwnerApplicationsDto,
  ): Promise<unknown[]> {
    const { vagaIds, stageOrderById, revealThreshold } =
      await this.resolveOwnerScope(actorId, dto);

    if (vagaIds.length === 0) return [];

    const qb = this.applicationsRepository
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.vaga', 'vaga')
      .where('app.vagaId IN (:...vagaIds)', { vagaIds })
      .orderBy('app.createdAt', 'DESC');

    if (dto.pipelineStage) {
      qb.andWhere('app.pipelineStage = :pipelineStage', {
        pipelineStage: dto.pipelineStage,
      });
    }
    if (dto.source) {
      qb.andWhere('app.source = :source', { source: dto.source });
    }
    if (dto.isRejected !== undefined) {
      qb.andWhere('app.isRejected = :isRejected', {
        isRejected: dto.isRejected,
      });
    }
    if (dto.q) {
      qb.andWhere('LOWER(app.snapshotFullName) LIKE :q', {
        q: `%${dto.q.toLowerCase()}%`,
      });
    }

    const apps = await qb.getMany();
    return apps.map((a) =>
      this.serializeOwnerApplication(a, stageOrderById, revealThreshold),
    );
  }

  /**
   * T-T04 — Consultoria: Pipeline Geral agregado (kanban de TODAS as vagas
   * ativas do time, com pill da vaga em cada card). Escopo: mesma regra de
   * `VagasService.listMine` (company do quotaOwner OU createdById de
   * qualquer membro ATIVO do time) — mantida em sincronia manualmente já
   * que os dois módulos não compartilham uma única fonte de verdade de
   * "vagas do time" (dívida técnica aceitável para o v1, ver CLAUDE.md).
   *
   * Máx. 50 candidaturas por etapa (RN de performance do design-spec) —
   * `stageCounts` informa o total real de cada etapa para o front decidir
   * se mostra "carregar mais" (não implementado no v1: lista já vem capada).
   */
  async listByTeam(
    actor: User,
    dto: ListTeamApplicationsDto,
  ): Promise<{ items: unknown[]; stageCounts: Record<string, number> }> {
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    if (!ctx.team) {
      throw new ForbiddenException(
        'Disponível apenas para workspaces de consultoria (time).',
      );
    }

    const teamUserIds = await this.teamContextHelper.getTeamUserIds(
      ctx.quotaOwner.id,
    );

    const vagaQb = this.vagasRepository
      .createQueryBuilder('vaga')
      .leftJoin('vaga.company', 'company')
      .select(['vaga.id', 'vaga.createdById'])
      .where(
        '(company.ownerId = :ownerId OR vaga.createdById IN (:...teamUserIds))',
        { ownerId: ctx.quotaOwner.id, teamUserIds },
      );
    if (dto.companyId) {
      vagaQb.andWhere('vaga.companyId = :companyId', { companyId: dto.companyId });
    }
    if (dto.assignedToId) {
      vagaQb.andWhere('vaga.assignedToId = :assignedToId', {
        assignedToId: dto.assignedToId,
      });
    }
    if (dto.vagaId) {
      vagaQb.andWhere('vaga.id = :vagaId', { vagaId: dto.vagaId });
    }
    const vagaRows = await vagaQb.getMany();
    const vagaIds = vagaRows.map((v) => v.id);

    if (vagaIds.length === 0) {
      return { items: [], stageCounts: {} };
    }

    // Resolve per-creator hunter-contact-reveal threshold + pipeline stage
    // order — a team can have vagas authored by different members, each
    // with their own template/threshold (mesma ressalva do T-T08).
    const creatorIds = [
      ...new Set(
        vagaRows
          .map((v) => v.createdById)
          .filter((id): id is string => id !== null),
      ),
    ];
    const owners = await this.usersRepository.find({
      where: creatorIds.map((id) => ({ id })),
      select: ['id', 'hunterContactRevealStageOrder'],
    });
    const revealByCreator = new Map(
      owners.map((o) => [o.id, o.hunterContactRevealStageOrder ?? 2]),
    );
    const templates = await this.pipelineTemplatesRepository.find({
      where: creatorIds.map((id) => ({ ownerId: id })),
    });
    const stageOrderByCreator = new Map(
      templates.map((t) => [
        t.ownerId,
        new Map((t.stages ?? []).map((s) => [s.id, s.order])),
      ]),
    );

    const qb = this.applicationsRepository
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.vaga', 'vaga')
      .leftJoin('vaga.company', 'company')
      .leftJoin('vaga.assignedTo', 'assignedTo')
      .addSelect(['company.id', 'company.name', 'company.logoUrl'])
      .addSelect([
        'assignedTo.id',
        'assignedTo.firstName',
        'assignedTo.lastName',
        'assignedTo.username',
        'assignedTo.avatarUrl',
      ])
      .where('app.vagaId IN (:...vagaIds)', { vagaIds })
      .andWhere('app.isRejected = false')
      .orderBy('app.pipelineStage', 'ASC')
      .addOrderBy('app.createdAt', 'DESC');

    if (dto.source) qb.andWhere('app.source = :source', { source: dto.source });
    if (dto.pipelineStage) {
      qb.andWhere('app.pipelineStage = :pipelineStage', {
        pipelineStage: dto.pipelineStage,
      });
    }
    if (dto.q) {
      qb.andWhere('LOWER(app.snapshotFullName) LIKE :q', {
        q: `%${dto.q.toLowerCase()}%`,
      });
    }

    const apps = await qb.getMany();

    const byStage = new Map<string, VagaApplication[]>();
    for (const a of apps) {
      const list = byStage.get(a.pipelineStage) ?? [];
      list.push(a);
      byStage.set(a.pipelineStage, list);
    }

    const stageCounts: Record<string, number> = {};
    const items: unknown[] = [];
    const MAX_PER_STAGE = 50;
    for (const [stage, list] of byStage) {
      stageCounts[stage] = list.length;
      for (const a of list.slice(0, MAX_PER_STAGE)) {
        const creatorId = a.vaga?.createdById ?? null;
        const revealThreshold = creatorId ? revealByCreator.get(creatorId) ?? 2 : 2;
        const stageOrderMap = creatorId
          ? stageOrderByCreator.get(creatorId) ?? new Map<string, number>()
          : new Map<string, number>();
        const isHunterSourced = a.source === ApplicationSource.HUNTER;
        const stageOrder = stageOrderMap.get(a.pipelineStage) ?? 0;
        const contactMasked = isHunterSourced && stageOrder < revealThreshold;

        items.push({
          id: a.id,
          vagaId: a.vagaId,
          vagaTitle: a.vaga?.title ?? null,
          vagaSlug: a.vaga?.slug ?? null,
          company: a.vaga?.company
            ? {
                id: a.vaga.company.id,
                name: a.vaga.company.name,
                logoUrl: a.vaga.company.logoUrl,
              }
            : null,
          assignedTo: a.vaga?.assignedTo
            ? {
                id: a.vaga.assignedTo.id,
                firstName: a.vaga.assignedTo.firstName,
                lastName: a.vaga.assignedTo.lastName,
                username: a.vaga.assignedTo.username,
                avatarUrl: a.vaga.assignedTo.avatarUrl,
              }
            : null,
          source: a.source,
          pipelineStage: a.pipelineStage,
          snapshotFullName: a.snapshotFullName,
          snapshotEmail: contactMasked ? null : a.snapshotEmail,
          snapshotPhone: contactMasked ? null : a.snapshotPhone,
          snapshotLocation: a.snapshotLocation,
          contactMasked,
          generalScore: a.generalScore,
          createdAt: a.createdAt,
        });
      }
    }

    return { items, stageCounts };
  }

  private serializeOwnerApplication(
    a: VagaApplication,
    stageOrderById: Map<string, number>,
    revealThreshold: number,
  ) {
    const isHunterSourced = a.source === ApplicationSource.HUNTER;
    const stageOrder = stageOrderById.get(a.pipelineStage) ?? 0;
    const contactMasked = isHunterSourced && stageOrder < revealThreshold;

    return {
      id: a.id,
      vagaId: a.vagaId,
      vagaTitle: a.vaga?.title ?? null,
      vagaSlug: a.vaga?.slug ?? null,
      source: a.source,
      pipelineStage: a.pipelineStage,
      isRejected: a.isRejected,
      snapshotFullName: a.snapshotFullName,
      snapshotEmail: contactMasked ? null : a.snapshotEmail,
      snapshotPhone: contactMasked ? null : a.snapshotPhone,
      snapshotLocation: a.snapshotLocation,
      contactMasked,
      generalScore: a.generalScore,
      createdAt: a.createdAt,
    };
  }

  async removeApplication(applicationId: string, actorId: string): Promise<void> {
    const app = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      select: ['id', 'userId'],
    });

    if (!app) {
      throw new NotFoundException('Candidatura não encontrada.');
    }

    if (app.userId !== actorId) {
      throw new ForbiddenException(
        'Você não tem permissão para remover esta candidatura.',
      );
    }

    await this.applicationsRepository.remove(app);
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<VagaApplication> {
    if (dto.pipelineStage === undefined && dto.isRejected === undefined) {
      throw new BadRequestException(
        'Informe pelo menos pipelineStage ou isRejected.',
      );
    }

    const app = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['vaga'],
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    if (app.vaga) {
      await this.assertCanManageVaga(
        app.vaga.createdById,
        actorId,
        actorRole,
        'Você não tem permissão para atualizar esta candidatura.',
      );
    }

    if (dto.pipelineStage !== undefined) {
      if (app.pipelineStage !== dto.pipelineStage) {
        const historyEntry: VagaApplication['stageHistory'][number] = {
          stage: dto.pipelineStage,
          enteredAt: new Date().toISOString(),
          byUserId: actorId,
        };
        app.stageHistory = [...(app.stageHistory ?? []), historyEntry];

        const vagaTitle = app.vaga?.title ?? 'sua candidatura';
        const notifyPayload = {
          type: NotificationType.STAGE_CHANGED,
          title: 'Etapa atualizada',
          message: `Sua candidatura para "${vagaTitle}" avançou para a etapa "${dto.pipelineStage}".`,
          // Candidato direto: manda pra página pública da vaga (slug, não id — rota é /vaga/:slug).
          link: app.vaga?.slug ? `/vaga/${app.vaga.slug}` : null,
          metadata: { applicationId: app.id, vagaId: app.vagaId, stage: dto.pipelineStage },
        };
        if (app.userId) {
          void this.notificationsService.create({ ...notifyPayload, userId: app.userId });
        }
        if (app.submittedByHunterId) {
          void this.notificationsService.create({
            ...notifyPayload,
            userId: app.submittedByHunterId,
            message: `A candidatura de "${app.snapshotFullName ?? 'seu candidato'}" para "${vagaTitle}" avançou para a etapa "${dto.pipelineStage}".`,
            // Hunter: /app/hunter/submissoes não existe — a tela real de acompanhamento
            // das submissões é /app/hunter/candidatos (lista + status de cada uma).
            link: `/app/hunter/candidatos`,
          });
        }
      }
      app.pipelineStage = dto.pipelineStage;
    }
    if (dto.isRejected !== undefined) {
      app.isRejected = dto.isRejected;
    }

    return this.applicationsRepository.save(app);
  }

  async updateGeneral(
    id: string,
    dto: UpdateGeneralDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<VagaApplication> {
    if (dto.generalScore === undefined && dto.generalNote === undefined) {
      throw new BadRequestException(
        'Informe pelo menos generalScore ou generalNote.',
      );
    }

    const app = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['vaga'],
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    if (app.vaga) {
      await this.assertCanManageVaga(
        app.vaga.createdById,
        actorId,
        actorRole,
        'Você não tem permissão para avaliar esta candidatura.',
      );
    }

    if (dto.generalScore !== undefined) app.generalScore = dto.generalScore;
    if (dto.generalNote !== undefined) app.generalNote = dto.generalNote;

    return this.applicationsRepository.save(app);
  }

  async updateStageNotes(
    id: string,
    stageKey: string,
    dto: UpdateStageNotesDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<VagaApplication> {
    const app = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['vaga'],
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    if (app.vaga) {
      await this.assertCanManageVaga(
        app.vaga.createdById,
        actorId,
        actorRole,
        'Você não tem permissão para anotar nesta candidatura.',
      );
    }

    const existing = app.stageNotes?.[stageKey] ?? {
      observacoes: '',
      nota: null,
      updatedAt: new Date().toISOString(),
      byUserId: actorId,
    };

    app.stageNotes = {
      ...(app.stageNotes ?? {}),
      [stageKey]: {
        observacoes:
          dto.observacoes !== undefined ? dto.observacoes : existing.observacoes,
        nota: dto.nota !== undefined ? dto.nota : existing.nota,
        updatedAt: new Date().toISOString(),
        byUserId: actorId,
      },
    };

    return this.applicationsRepository.save(app);
  }

  async getHistory(
    id: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<unknown[]> {
    const app = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['vaga'],
      select: ['id', 'stageHistory', 'vaga'],
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    if (app.vaga) {
      await this.assertCanManageVaga(
        app.vaga.createdById,
        actorId,
        actorRole,
        'Você não tem permissão para ver o histórico desta candidatura.',
      );
    }

    const history = app.stageHistory ?? [];
    const userIds = [...new Set(history.map((e) => e.byUserId))];

    let authorMap = new Map<string, string>();
    if (userIds.length > 0) {
      const authors = await this.usersRepository.find({
        where: userIds.map((uid) => ({ id: uid })),
        select: ['id', 'firstName', 'lastName'],
      });
      authorMap = new Map(
        authors.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
      );
    }

    return [...history].reverse().map((entry) => ({
      stage: entry.stage,
      enteredAt: entry.enteredAt,
      byUserId: entry.byUserId,
      byUserName: authorMap.get(entry.byUserId) ?? 'Recrutador',
      note: entry.note ?? null,
    }));
  }
}
