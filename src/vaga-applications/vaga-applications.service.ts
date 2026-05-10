import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApplicationSource,
  ApplicationStatus,
  VagaApplication,
} from './vaga-application.entity';
import { Vaga, VagaSource, VagaStatus } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';
import { User } from '../users/user.entity';
import { ApplyDto } from './dto/apply.dto';
import { GupyService } from '../gupy/gupy.service';

export interface ApplyResult {
  application: VagaApplication;
  redirectUrl?: string;
}

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
    private readonly gupyService: GupyService,
  ) {}

  async apply(
    userId: string,
    slug: string,
    dto: ApplyDto,
  ): Promise<ApplyResult> {
    const vaga = await this.vagasRepository.findOne({
      where: { slug },
      relations: ['gupyConfig'],
    });
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

    const isGupy = vaga.source === VagaSource.GUPY;

    const application = this.applicationsRepository.create({
      vagaId: vaga.id,
      userId,
      cvId: dto.cvId ?? null,
      message: dto.message ?? null,
      snapshotFullName: dto.fullName,
      snapshotEmail: dto.email,
      snapshotPhone: dto.phone ?? null,
      snapshotLocation: dto.location ?? null,
      status: ApplicationStatus.PENDING,
      source: isGupy
        ? ApplicationSource.GUPY_REDIRECT
        : ApplicationSource.NATIVE,
    });

    const saved = await this.applicationsRepository.save(application);

    if (isGupy && vaga.gupyConfig && vaga.externalJobId) {
      const redirectUrl = this.gupyService.buildJobUrl(
        vaga.gupyConfig.subdomain,
        vaga.externalJobId,
      );
      return { application: saved, redirectUrl };
    }

    return { application: saved };
  }

  async listMine(userId: string): Promise<any[]> {
    const apps = await this.applicationsRepository.find({
      where: { userId },
      relations: ['vaga', 'vaga.gupyConfig'],
      order: { createdAt: 'DESC' },
    });

    return apps.map((a) => {
      let externalUrl: string | null = null;
      if (
        a.vaga &&
        a.vaga.source === VagaSource.GUPY &&
        a.vaga.gupyConfig &&
        a.vaga.externalJobId
      ) {
        externalUrl = this.gupyService.buildJobUrl(
          a.vaga.gupyConfig.subdomain,
          a.vaga.externalJobId,
        );
      }
      return {
        id: a.id,
        status: a.status,
        source: a.source,
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
              source: a.vaga.source,
              companyName: a.vaga.companyName,
              externalUrl,
            }
          : null,
      };
    });
  }

  async listByVaga(vagaId: string): Promise<any[]> {
    const apps = await this.applicationsRepository.find({
      where: { vagaId },
      relations: ['user', 'cv'],
      order: { createdAt: 'DESC' },
    });

    return apps.map((a) => ({
      id: a.id,
      status: a.status,
      source: a.source,
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

  async updateStatus(id: string, status: ApplicationStatus): Promise<VagaApplication> {
    const app = await this.applicationsRepository.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Candidatura não encontrada.');
    app.status = status;
    return this.applicationsRepository.save(app);
  }
}
