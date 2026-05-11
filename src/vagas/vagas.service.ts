import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { Vaga, VagaStatus } from './vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { UserRole } from '../users/user.entity';
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

  /** Lists all vagas owned by the given user (for dashboard self-service view) */
  async listMine(userId: string, dto: ListVagasDto) {
    const { page = 1, limit = 10, q, status, type, workMode } = dto;

    const qb = this.vagasRepository
      .createQueryBuilder('vaga')
      .where('vaga.createdById = :userId', { userId })
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

  async create(userId: string, dto: CreateVagaDto): Promise<Vaga> {
    const slug = await this.generateUniqueSlug(dto.title);

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
      status: dto.status ?? VagaStatus.DRAFT,
      contactEmail: dto.contactEmail ?? null,
      createdById: userId,
    });

    return this.vagasRepository.save(vaga);
  }

  async update(
    id: string,
    dto: UpdateVagaDto,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Vaga> {
    const vaga = await this.findById(id);
    this.assertOwnerOrAdmin(vaga, actorId, actorRole);

    if (dto.title && dto.title !== vaga.title) {
      vaga.slug = await this.generateUniqueSlug(dto.title, id);
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
      status: dto.status ?? vaga.status,
      contactEmail: dto.contactEmail !== undefined ? dto.contactEmail : vaga.contactEmail,
    });

    return this.vagasRepository.save(vaga);
  }

  async remove(id: string, actorId: string, actorRole: UserRole): Promise<void> {
    const vaga = await this.findById(id);
    this.assertOwnerOrAdmin(vaga, actorId, actorRole);
    await this.vagasRepository.remove(vaga);
  }

  /** Throws ForbiddenException if actor is neither the vaga creator nor an admin */
  private assertOwnerOrAdmin(
    vaga: Vaga,
    actorId: string,
    actorRole: UserRole,
  ): void {
    if (vaga.createdById !== actorId && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para modificar esta vaga.',
      );
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
