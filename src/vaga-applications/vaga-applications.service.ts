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
  ApplicationStatus,
  VagaApplication,
} from './vaga-application.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';
import { User, UserRole } from '../users/user.entity';
import { ApplyDto } from './dto/apply.dto';

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
      status: ApplicationStatus.PENDING,
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
      status: a.status,
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
      status: a.status,
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
   * Updates the status of an application.
   * Enforces ownership: only the vaga creator or an admin may change status.
   */
  async updateStatus(
    id: string,
    status: ApplicationStatus,
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
        'Você não tem permissão para atualizar esta candidatura.',
      );
    }

    app.status = status;
    return this.applicationsRepository.save(app);
  }
}
