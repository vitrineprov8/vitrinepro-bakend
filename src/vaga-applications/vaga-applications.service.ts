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
