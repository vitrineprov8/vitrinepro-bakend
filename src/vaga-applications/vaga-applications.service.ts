import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VagaApplication } from './vaga-application.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';
import { User, UserRole } from '../users/user.entity';
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
  ) {}

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

    // Company accounts cannot apply to vagas as candidates
    if (user.isCompany) {
      throw new ForbiddenException(
        'Contas empresariais não podem se candidatar a vagas. Use uma conta de profissional.',
      );
    }

    // Sync empty profile fields with data provided in the application
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
      // New pipeline fields — application starts at the first default stage
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

  /**
   * Lists applications for a vaga.
   * Enforces ownership: only the vaga creator or an admin may view applications.
   */
  async listByVaga(
    vagaId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<unknown[]> {
    const vaga = await this.vagasRepository.findOne({ where: { id: vagaId } });
    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    if (vaga.createdById !== actorId && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para ver as candidaturas desta vaga.',
      );
    }

    const apps = await this.applicationsRepository.find({
      where: { vagaId },
      relations: ['user', 'cv'],
      order: { createdAt: 'DESC' },
    });

    return apps.map((a) => ({
      id: a.id,
      pipelineStage: a.pipelineStage,
      isRejected: a.isRejected,
      message: a.message,
      snapshotFullName: a.snapshotFullName,
      snapshotEmail: a.snapshotEmail,
      snapshotPhone: a.snapshotPhone,
      snapshotLocation: a.snapshotLocation,
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
    }));
  }

  /**
   * Removes an application — only the applicant (application.userId) may call this.
   * Hard delete: the application row is permanently removed.
   * Returns void; controller responds 204.
   */
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

  /**
   * Updates the pipeline stage (and/or isRejected flag) of an application.
   * Enforces ownership: only the vaga creator or an admin may change stage.
   *
   * At least one of dto.pipelineStage / dto.isRejected must be provided
   * (enforced by the DTO validator and the guard below).
   */
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

    if (
      app.vaga &&
      app.vaga.createdById !== actorId &&
      actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar esta candidatura.',
      );
    }

    if (dto.pipelineStage !== undefined) {
      // Only append to stageHistory when the stage actually changes
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

  // ── Phase 3: general score / note ─────────────────────────────────────────

  /**
   * Updates the recruiter's general evaluation fields.
   * Only the vaga creator or admin may call this.
   */
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

    if (
      app.vaga &&
      app.vaga.createdById !== actorId &&
      actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para avaliar esta candidatura.',
      );
    }

    if (dto.generalScore !== undefined) app.generalScore = dto.generalScore;
    if (dto.generalNote !== undefined) app.generalNote = dto.generalNote;

    return this.applicationsRepository.save(app);
  }

  // ── Phase 3: per-stage notes ──────────────────────────────────────────────

  /**
   * Creates or merges notes for a specific pipeline stage.
   * Stored in stageNotes[stageKey] as { observacoes, nota, updatedAt, byUserId }.
   */
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

    if (
      app.vaga &&
      app.vaga.createdById !== actorId &&
      actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
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

  // ── Phase 3: stage history ────────────────────────────────────────────────

  /**
   * Returns stageHistory in reverse-chronological order, enriched with the
   * author's full name resolved via a single bulk query.
   */
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

    if (
      app.vaga &&
      app.vaga.createdById !== actorId &&
      actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
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
