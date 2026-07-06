import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ProcessShareLink } from './process-share-link.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { Vaga } from '../vagas/vaga.entity';
import { User, UserRole } from '../users/user.entity';
import { CreateShareDto } from './dto/create-share.dto';

const DEFAULT_EXPIRE_DAYS = 30;
const MAX_EXPIRE_DAYS = 365;

@Injectable()
export class ProcessShareService {
  constructor(
    @InjectRepository(ProcessShareLink)
    private shareLinksRepository: Repository<ProcessShareLink>,
    @InjectRepository(VagaApplication)
    private applicationsRepository: Repository<VagaApplication>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private async loadAndAuthorize(
    applicationId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<VagaApplication> {
    const app = await this.applicationsRepository.findOne({
      where: { id: applicationId },
      relations: ['vaga'],
    });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    if (
      app.vaga &&
      app.vaga.createdById !== actorId &&
      actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar este compartilhamento.',
      );
    }

    return app;
  }

  async create(
    applicationId: string,
    dto: CreateShareDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<{ token: string; url: string }> {
    await this.loadAndAuthorize(applicationId, actorId, actorRole);

    const days =
      dto.expiresInDays === undefined || dto.expiresInDays === null
        ? DEFAULT_EXPIRE_DAYS
        : Math.min(dto.expiresInDays, MAX_EXPIRE_DAYS);

    let expiresAt: Date | null = null;
    if (days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    const token = crypto.randomBytes(32).toString('hex');

    const link = this.shareLinksRepository.create({
      applicationId,
      token,
      expiresAt,
      createdById: actorId,
      revokedAt: null,
    });

    await this.shareLinksRepository.save(link);

    return { token, url: this.buildPublicUrl(token) };
  }

  private buildPublicUrl(token: string): string {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:4321'
    ).replace(/\/$/, '');
    return `${frontendUrl}/processo/${token}`;
  }

  async revoke(
    applicationId: string,
    token: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<void> {
    await this.loadAndAuthorize(applicationId, actorId, actorRole);

    const link = await this.shareLinksRepository.findOne({
      where: { applicationId, token },
    });
    if (!link) throw new NotFoundException('Link não encontrado.');

    link.revokedAt = new Date();
    await this.shareLinksRepository.save(link);
  }

  async listLinks(
    applicationId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<ShareLinkSummary[]> {
    await this.loadAndAuthorize(applicationId, actorId, actorRole);

    const links = await this.shareLinksRepository.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    return links.map((l) => ({
      token: l.token,
      url: this.buildPublicUrl(l.token),
      expiresAt: l.expiresAt,
      revokedAt: l.revokedAt,
      createdAt: l.createdAt,
      isActive: !l.revokedAt && (!l.expiresAt || l.expiresAt > now),
    }));
  }

  async getPublicProcess(token: string): Promise<PublicProcessSnapshot> {
    const link = await this.shareLinksRepository.findOne({
      where: { token },
    });

    if (!link || link.revokedAt) {
      throw new NotFoundException('Link inválido ou revogado.');
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new NotFoundException('Este link expirou.');
    }

    const app = await this.applicationsRepository.findOne({
      where: { id: link.applicationId },
      relations: ['vaga', 'vaga.company', 'vaga.createdBy', 'user'],
    });

    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    const companyName =
      app.vaga?.company?.name ?? app.vaga?.createdBy?.companyName ?? null;

    const userIds = [
      ...new Set(app.stageHistory.map((e) => e.byUserId)),
    ];

    const authors = await this.usersRepository.find({
      where: userIds.map((id) => ({ id })),
      select: ['id', 'firstName', 'lastName'],
    });
    const authorMap = new Map(
      authors.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    const historyWithNames = [...app.stageHistory]
      .reverse()
      .map((entry) => ({
        stage: entry.stage,
        enteredAt: entry.enteredAt,
        byUserName: authorMap.get(entry.byUserId) ?? 'Recrutador',
        note: entry.note ?? null,
      }));

    return {
      candidate: {
        name: app.snapshotFullName,
        avatarUrl: app.user?.avatarUrl ?? null,
        profession: app.user?.profession ?? null,
      },
      vaga: app.vaga
        ? {
            title: app.vaga.title,
            segment: app.vaga.segment,
            location: app.vaga.location,
            companyName,
          }
        : null,
      pipelineStage: app.pipelineStage,
      isRejected: app.isRejected,
      generalScore: app.generalScore,
      generalNote: app.generalNote,
      stageHistory: historyWithNames,
      stageNotes: app.stageNotes,
      appliedAt: app.createdAt,
    };
  }

  async getActiveLink(applicationId: string): Promise<ProcessShareLink | null> {
    const now = new Date();
    const link = await this.shareLinksRepository
      .createQueryBuilder('l')
      .where('l.applicationId = :applicationId', { applicationId })
      .andWhere('l.revokedAt IS NULL')
      .andWhere('(l.expiresAt IS NULL OR l.expiresAt > :now)', { now })
      .orderBy('l.createdAt', 'DESC')
      .getOne();
    return link ?? null;
  }
}

export interface PublicProcessSnapshot {
  candidate: {
    name: string;
    avatarUrl: string | null;
    profession: string | null;
  };
  vaga: {
    title: string;
    segment: string | null;
    location: string | null;
    companyName: string | null;
  } | null;
  pipelineStage: string;
  isRejected: boolean;
  generalScore: number | null;
  generalNote: string | null;
  stageHistory: Array<{
    stage: string;
    enteredAt: string;
    byUserName: string;
    note: string | null;
  }>;
  stageNotes: Record<
    string,
    { observacoes: string; nota: number | null; updatedAt: string; byUserId: string }
  >;
  appliedAt: Date;
}

export interface ShareLinkSummary {
  token: string;
  url: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  isActive: boolean;
}
