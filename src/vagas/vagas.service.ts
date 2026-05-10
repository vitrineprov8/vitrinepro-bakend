import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';
import { Vaga, VagaSource, VagaStatus } from './vaga.entity';
import { CreateVagaDto } from './dto/create-vaga.dto';
import { UpdateVagaDto } from './dto/update-vaga.dto';
import { ListVagasDto } from './dto/list-vagas.dto';
import { paginate } from '../common/paginate.helper';
import { GupyService } from '../gupy/gupy.service';

@Injectable()
export class VagasService {
  constructor(
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
    private readonly gupyService: GupyService,
  ) {}

  serializeVaga(vaga: Vaga): any {
    let externalUrl: string | null = null;
    if (vaga.source === VagaSource.GUPY && vaga.gupyConfig && vaga.externalJobId) {
      externalUrl = this.gupyService.buildJobUrl(
        vaga.gupyConfig.subdomain,
        vaga.externalJobId,
      );
    }
    return {
      ...vaga,
      externalUrl,
    };
  }

  async listPublic(dto: ListVagasDto) {
    const { page = 1, limit = 10, q, type, workMode } = dto;

    const qb = this.vagasRepository
      .createQueryBuilder('vaga')
      .leftJoinAndSelect('vaga.gupyConfig', 'gupyConfig')
      .where('vaga.status = :status', { status: VagaStatus.PUBLISHED })
      .andWhere('(vaga.deadline IS NULL OR vaga.deadline > NOW())')
      .orderBy('vaga.createdAt', 'DESC');

    if (q) {
      qb.andWhere(
        '(LOWER(vaga.title) LIKE :q OR LOWER(vaga.description) LIKE :q OR LOWER(COALESCE(vaga.companyName, \'\')) LIKE :q)',
        { q: `%${q.toLowerCase()}%` },
      );
    }
    if (type) qb.andWhere('vaga.type = :type', { type });
    if (workMode) qb.andWhere('vaga.workMode = :workMode', { workMode });

    const result = await paginate(qb, page, limit);
    return {
      ...result,
      data: result.data.map((v) => this.serializeVaga(v)),
    };
  }

  async listAdmin(dto: ListVagasDto) {
    const { page = 1, limit = 10, q, status, type, workMode } = dto;

    const qb = this.vagasRepository
      .createQueryBuilder('vaga')
      .leftJoinAndSelect('vaga.gupyConfig', 'gupyConfig')
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
    return {
      ...result,
      data: result.data.map((v) => this.serializeVaga(v)),
    };
  }

  async findBySlugPublic(slug: string): Promise<any> {
    const vaga = await this.vagasRepository.findOne({
      where: { slug },
      relations: ['gupyConfig'],
    });
    if (!vaga || vaga.status !== VagaStatus.PUBLISHED) {
      throw new NotFoundException('Vaga não encontrada.');
    }
    if (vaga.deadline && vaga.deadline < new Date()) {
      throw new NotFoundException('Vaga não disponível.');
    }
    return this.serializeVaga(vaga);
  }

  async findById(id: string): Promise<Vaga> {
    const vaga = await this.vagasRepository.findOne({
      where: { id },
      relations: ['gupyConfig'],
    });
    if (!vaga) throw new NotFoundException('Vaga não encontrada.');
    return vaga;
  }

  async create(adminId: string, dto: CreateVagaDto): Promise<any> {
    const source = dto.source ?? VagaSource.NATIVE;
    let companyName = dto.companyName ?? null;
    let gupyConfigId: string | null = null;
    let externalJobId: string | null = null;
    let slug: string;

    if (source === VagaSource.GUPY) {
      if (!dto.gupyConfigId || !dto.externalJobId) {
        throw new BadRequestException(
          'gupyConfigId e externalJobId são obrigatórios para vagas Gupy.',
        );
      }
      const config = await this.gupyService.findById(dto.gupyConfigId);
      if (!config.enabled) {
        throw new BadRequestException(
          'Esta configuração Gupy está desabilitada.',
        );
      }
      gupyConfigId = config.id;
      externalJobId = dto.externalJobId.trim();
      if (!companyName) companyName = config.displayName;
      slug = await this.generateUniqueSlug(
        `gupy-${config.subdomain}-${externalJobId}`,
      );
    } else {
      slug = await this.generateUniqueSlug(dto.title);
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
      status: dto.status ?? VagaStatus.DRAFT,
      contactEmail: dto.contactEmail ?? null,
      source,
      companyName,
      gupyConfigId,
      externalJobId,
      createdById: adminId,
    });

    const saved = await this.vagasRepository.save(vaga);
    return this.findById(saved.id).then((v) => this.serializeVaga(v));
  }

  async update(id: string, dto: UpdateVagaDto): Promise<any> {
    const vaga = await this.findById(id);

    // Native vagas: regenerate slug from title.
    // Gupy vagas: slug is stable (gupy-{subdomain}-{jobId}); only regenerate if external link changes.
    const targetSource = dto.source ?? vaga.source;

    if (targetSource === VagaSource.GUPY) {
      const newGupyConfigId = dto.gupyConfigId ?? vaga.gupyConfigId;
      const newExternalJobId =
        dto.externalJobId !== undefined ? dto.externalJobId : vaga.externalJobId;
      if (!newGupyConfigId || !newExternalJobId) {
        throw new BadRequestException(
          'gupyConfigId e externalJobId são obrigatórios para vagas Gupy.',
        );
      }
      const config = await this.gupyService.findById(newGupyConfigId);
      if (!config.enabled && newGupyConfigId !== vaga.gupyConfigId) {
        throw new BadRequestException(
          'Esta configuração Gupy está desabilitada.',
        );
      }
      const linkChanged =
        newGupyConfigId !== vaga.gupyConfigId ||
        newExternalJobId !== vaga.externalJobId;
      if (linkChanged) {
        vaga.slug = await this.generateUniqueSlug(
          `gupy-${config.subdomain}-${newExternalJobId.trim()}`,
          id,
        );
      }
      vaga.source = VagaSource.GUPY;
      vaga.gupyConfigId = newGupyConfigId;
      vaga.externalJobId = newExternalJobId.trim();
      if (dto.companyName !== undefined) {
        vaga.companyName = dto.companyName;
      } else if (!vaga.companyName) {
        vaga.companyName = config.displayName;
      }
    } else {
      // NATIVE
      if (dto.title && dto.title !== vaga.title) {
        vaga.slug = await this.generateUniqueSlug(dto.title, id);
      }
      vaga.source = VagaSource.NATIVE;
      vaga.gupyConfigId = null;
      vaga.externalJobId = null;
      if (dto.companyName !== undefined) vaga.companyName = dto.companyName;
    }

    Object.assign(vaga, {
      title: dto.title ?? vaga.title,
      description: dto.description ?? vaga.description,
      requirements:
        dto.requirements !== undefined ? dto.requirements : vaga.requirements,
      benefits: dto.benefits !== undefined ? dto.benefits : vaga.benefits,
      location: dto.location !== undefined ? dto.location : vaga.location,
      type: dto.type !== undefined ? dto.type : vaga.type,
      workMode: dto.workMode !== undefined ? dto.workMode : vaga.workMode,
      salaryMin:
        dto.salaryMin !== undefined ? dto.salaryMin : vaga.salaryMin,
      salaryMax:
        dto.salaryMax !== undefined ? dto.salaryMax : vaga.salaryMax,
      deadline:
        dto.deadline !== undefined
          ? dto.deadline
            ? new Date(dto.deadline)
            : null
          : vaga.deadline,
      status: dto.status ?? vaga.status,
      contactEmail:
        dto.contactEmail !== undefined ? dto.contactEmail : vaga.contactEmail,
    });

    await this.vagasRepository.save(vaga);
    return this.findById(id).then((v) => this.serializeVaga(v));
  }

  async remove(id: string): Promise<void> {
    const vaga = await this.findById(id);
    await this.vagasRepository.remove(vaga);
  }

  private async generateUniqueSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = slugify(base, { lower: true, strict: true });
    let slug = baseSlug;
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
      slug = `${baseSlug}-${counter++}`;
    }

    return slug;
  }
}
