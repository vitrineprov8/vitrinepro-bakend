import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus, ProjectWorkStatus } from './project.entity';
import { ProjectImage } from './project-image.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { TagsService } from '../tags/tags.service';
import { StorageService } from '../storage/storage.service';
import { paginate } from '../common/paginate.helper';
import slugify from 'slugify';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(ProjectImage)
    private imagesRepository: Repository<ProjectImage>,
    private tagsService: TagsService,
    private storageService: StorageService,
  ) {}

  async findAll(dto: ListProjectsDto) {
    const { page = 1, limit = 10, tag, userId, projectStatus, status } = dto;

    const qb = this.projectsRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.tags', 'tag')
      .leftJoin('project.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.avatarUrl', 'user.profession', 'user.username'])
      .orderBy('project.createdAt', 'DESC');

    if (status) {
      qb.andWhere('project.status = :status', { status });
    } else {
      qb.andWhere('project.status = :status', { status: ProjectStatus.PUBLISHED });
    }

    if (tag) {
      qb.andWhere('tag.slug = :tag', { tag });
    }

    if (userId) {
      qb.andWhere('project.userId = :userId', { userId });
    }

    if (projectStatus) {
      qb.andWhere('project.projectStatus = :projectStatus', { projectStatus });
    }

    const result = await paginate(qb, page, limit);

    return {
      ...result,
      data: result.data.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        slug: p.slug,
        description: p.description,
        coverImageUrl: p.coverImageUrl,
        clientName: p.clientName,
        year: p.year,
        projectStatus: p.projectStatus,
        tags: p.tags,
        author: (p as any).user,
      })),
    };
  }

  async findBySlug(slug: string, userId?: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { slug },
      relations: ['tags', 'user', 'images'],
      order: { images: { order: 'ASC' } } as any,
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    if (project.status !== ProjectStatus.PUBLISHED && project.userId !== userId) {
      throw new NotFoundException('Projeto não disponível.');
    }
    return project;
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const slug = await this.generateUniqueSlug(dto.title);
    const tags = dto.tagIds ? await this.tagsService.findByIds(dto.tagIds) : [];

    const project = this.projectsRepository.create({
      userId,
      title: dto.title,
      subtitle: dto.subtitle,
      slug,
      description: dto.description,
      content: dto.content || {},
      clientName: dto.clientName,
      year: dto.year,
      duration: dto.duration,
      role: dto.role,
      projectStatus: dto.projectStatus || ProjectWorkStatus.ONGOING,
      status: dto.status || ProjectStatus.DRAFT,
      externalUrl: dto.externalUrl,
      tags,
    });

    return this.projectsRepository.save(project);
  }

  async update(id: string, userId: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOneOrFail(id, userId);

    if (dto.title && dto.title !== project.title) {
      project.slug = await this.generateUniqueSlug(dto.title, id);
    }

    if (dto.tagIds !== undefined) {
      project.tags = await this.tagsService.findByIds(dto.tagIds);
    }

    Object.assign(project, {
      title: dto.title ?? project.title,
      subtitle: dto.subtitle ?? project.subtitle,
      description: dto.description ?? project.description,
      content: dto.content ?? project.content,
      clientName: dto.clientName ?? project.clientName,
      year: dto.year ?? project.year,
      duration: dto.duration ?? project.duration,
      role: dto.role ?? project.role,
      projectStatus: dto.projectStatus ?? project.projectStatus,
      status: dto.status ?? project.status,
      externalUrl: dto.externalUrl ?? project.externalUrl,
    });

    return this.projectsRepository.save(project);
  }

  async delete(id: string, userId: string): Promise<void> {
    const project = await this.findOneOrFail(id, userId);

    if (project.coverImageKey) {
      await this.storageService.deleteFile(project.coverImageKey);
    }

    const images = await this.imagesRepository.find({ where: { projectId: id } });
    for (const img of images) {
      await this.storageService.deleteFile(img.imageKey);
    }

    await this.projectsRepository.remove(project);
  }

  async uploadCover(id: string, userId: string, file: Express.Multer.File): Promise<Project> {
    const project = await this.findOneOrFail(id, userId);
    this.storageService.validateImage(file.buffer, file.mimetype);

    if (project.coverImageKey) {
      await this.storageService.deleteFile(project.coverImageKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'cover');
    const key = `projects/covers/${id}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    project.coverImageUrl = url;
    project.coverImageKey = key;
    return this.projectsRepository.save(project);
  }

  async addImage(
    projectId: string,
    userId: string,
    file: Express.Multer.File,
    caption?: string,
  ): Promise<ProjectImage> {
    const project = await this.findOneOrFail(projectId, userId);
    this.storageService.validateImage(file.buffer, file.mimetype);

    const maxOrderResult = await this.imagesRepository
      .createQueryBuilder('img')
      .select('MAX(img.order)', 'maxOrder')
      .where('img.projectId = :projectId', { projectId })
      .getRawOne();

    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

    const processed = await this.storageService.processImage(file.buffer, 'content');
    const timestamp = Date.now();
    const key = `projects/${projectId}/images/${timestamp}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    const image = this.imagesRepository.create({
      projectId,
      imageUrl: url,
      imageKey: key,
      caption,
      order: nextOrder,
    });

    return this.imagesRepository.save(image);
  }

  async deleteImage(projectId: string, imageId: string, userId: string): Promise<void> {
    await this.findOneOrFail(projectId, userId);
    const image = await this.imagesRepository.findOne({ where: { id: imageId, projectId } });
    if (!image) throw new NotFoundException('Imagem não encontrada.');
    await this.storageService.deleteFile(image.imageKey);
    await this.imagesRepository.remove(image);
  }

  async reorderImages(
    projectId: string,
    userId: string,
    orders: { id: string; order: number }[],
  ): Promise<void> {
    await this.findOneOrFail(projectId, userId);
    for (const item of orders) {
      await this.imagesRepository.update({ id: item.id, projectId }, { order: item.order });
    }
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 2;

    while (true) {
      const qb = this.projectsRepository
        .createQueryBuilder('project')
        .where('project.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('project.id != :id', { id: excludeId });
      }
      const existing = await qb.getOne();
      if (!existing) break;
      slug = `${base}-${counter++}`;
    }

    return slug;
  }

  private async findOneOrFail(id: string, userId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    if (project.userId !== userId) throw new ForbiddenException('Acesso negado.');
    return project;
  }
}
