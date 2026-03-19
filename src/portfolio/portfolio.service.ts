import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioItem, PortfolioStatus } from './portfolio.entity';
import { PortfolioFile, PortfolioFileType } from './portfolio-file.entity';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { ListPortfolioDto } from './dto/list-portfolio.dto';
import { TagsService } from '../tags/tags.service';
import { StorageService } from '../storage/storage.service';
import { paginate } from '../common/paginate.helper';
import slugify from 'slugify';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PortfolioItem)
    private portfolioRepository: Repository<PortfolioItem>,
    @InjectRepository(PortfolioFile)
    private filesRepository: Repository<PortfolioFile>,
    private tagsService: TagsService,
    private storageService: StorageService,
  ) {}

  async findAll(dto: ListPortfolioDto) {
    const { page = 1, limit = 10, tag, userId, status } = dto;

    const qb = this.portfolioRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.tags', 'tag')
      .leftJoin('item.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.avatarUrl', 'user.profession', 'user.username'])
      .orderBy('item.createdAt', 'DESC');

    if (status) {
      qb.andWhere('item.status = :status', { status });
    } else {
      qb.andWhere('item.status = :status', { status: PortfolioStatus.PUBLISHED });
    }

    if (tag) {
      qb.andWhere('tag.slug = :tag', { tag });
    }

    if (userId) {
      qb.andWhere('item.userId = :userId', { userId });
    }

    const result = await paginate(qb, page, limit);

    return {
      ...result,
      data: result.data.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        slug: item.slug,
        coverImageUrl: item.coverImageUrl,
        clientName: item.clientName,
        year: item.year,
        projectStatus: item.projectStatus,
        status: item.status,
        tags: item.tags,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        author: (item as any).user,
      })),
    };
  }

  async findBySlug(slug: string, userId?: string): Promise<PortfolioItem> {
    const item = await this.portfolioRepository.findOne({
      where: { slug },
      relations: ['tags', 'user', 'files'],
      order: { files: { order: 'ASC' } } as any,
    });
    if (!item) throw new NotFoundException('Item de portfólio não encontrado.');
    if (item.status !== PortfolioStatus.PUBLISHED && item.userId !== userId) {
      throw new NotFoundException('Item não disponível.');
    }
    return item;
  }

  async create(userId: string, dto: CreatePortfolioDto): Promise<PortfolioItem> {
    const slug = await this.generateUniqueSlug(dto.title);
    const tags = dto.tagIds ? await this.tagsService.findByIds(dto.tagIds, userId) : [];

    const item = this.portfolioRepository.create({
      userId,
      title: dto.title,
      subtitle: dto.subtitle,
      slug,
      content: dto.content || {},
      clientName: dto.clientName,
      year: dto.year,
      duration: dto.duration,
      role: dto.role,
      projectStatus: dto.projectStatus || null,
      status: dto.status || PortfolioStatus.DRAFT,
      externalUrl: dto.externalUrl,
      tags,
    });

    return this.portfolioRepository.save(item);
  }

  async update(id: string, userId: string, dto: UpdatePortfolioDto): Promise<PortfolioItem> {
    const item = await this.findOneOrFail(id, userId);

    if (dto.title && dto.title !== item.title) {
      item.slug = await this.generateUniqueSlug(dto.title, id);
    }

    if (dto.tagIds !== undefined) {
      item.tags = await this.tagsService.findByIds(dto.tagIds, userId);
    }

    Object.assign(item, {
      title: dto.title ?? item.title,
      subtitle: dto.subtitle ?? item.subtitle,
      content: dto.content ?? item.content,
      clientName: dto.clientName ?? item.clientName,
      year: dto.year ?? item.year,
      duration: dto.duration ?? item.duration,
      role: dto.role ?? item.role,
      projectStatus: dto.projectStatus !== undefined ? dto.projectStatus : item.projectStatus,
      status: dto.status ?? item.status,
      externalUrl: dto.externalUrl ?? item.externalUrl,
    });

    return this.portfolioRepository.save(item);
  }

  async delete(id: string, userId: string): Promise<void> {
    const item = await this.findOneOrFail(id, userId);

    if (item.coverImageKey) {
      await this.storageService.deleteFile(item.coverImageKey);
    }

    const files = await this.filesRepository.find({ where: { portfolioItemId: id } });
    for (const file of files) {
      await this.storageService.deleteFile(file.fileKey);
    }

    await this.portfolioRepository.remove(item);
  }

  async uploadCover(id: string, userId: string, file: Express.Multer.File): Promise<PortfolioItem> {
    const item = await this.findOneOrFail(id, userId);
    this.storageService.validateImage(file.buffer, file.mimetype);

    if (item.coverImageKey) {
      await this.storageService.deleteFile(item.coverImageKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'cover');
    const key = `portfolio/covers/${id}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    item.coverImageUrl = url;
    item.coverImageKey = key;
    return this.portfolioRepository.save(item);
  }

  async addFile(
    portfolioItemId: string,
    userId: string,
    file: Express.Multer.File,
    caption?: string,
  ): Promise<PortfolioFile> {
    const item = await this.findOneOrFail(portfolioItemId, userId);

    const maxOrderResult = await this.filesRepository
      .createQueryBuilder('f')
      .select('MAX(f.order)', 'maxOrder')
      .where('f.portfolioItemId = :portfolioItemId', { portfolioItemId })
      .getRawOne();

    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;
    const isPdf = file.mimetype === 'application/pdf';

    let fileUrl: string;
    let fileKey: string;
    let fileType: PortfolioFileType;

    if (isPdf) {
      this.storageService.validatePdf(file.buffer, file.mimetype);
      const timestamp = Date.now();
      fileKey = `portfolio/${item.id}/files/${timestamp}.pdf`;
      fileUrl = await this.storageService.uploadFile(file.buffer, fileKey, 'application/pdf');
      fileType = PortfolioFileType.PDF;
    } else {
      this.storageService.validateImage(file.buffer, file.mimetype);
      const processed = await this.storageService.processImage(file.buffer, 'content');
      const timestamp = Date.now();
      fileKey = `portfolio/${item.id}/files/${timestamp}.webp`;
      fileUrl = await this.storageService.uploadFile(processed, fileKey, 'image/webp');
      fileType = PortfolioFileType.IMAGE;
    }

    const portfolioFile = this.filesRepository.create({
      portfolioItemId: item.id,
      fileUrl,
      fileKey,
      fileType,
      mimeType: file.mimetype,
      caption: caption || null,
      originalFilename: isPdf ? file.originalname : null,
      fileSize: isPdf ? file.size : null,
      order: nextOrder,
    });

    return this.filesRepository.save(portfolioFile);
  }

  async deleteFile(portfolioItemId: string, fileId: string, userId: string): Promise<void> {
    await this.findOneOrFail(portfolioItemId, userId);
    const file = await this.filesRepository.findOne({ where: { id: fileId, portfolioItemId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    await this.storageService.deleteFile(file.fileKey);
    await this.filesRepository.remove(file);
  }

  async reorderFiles(
    portfolioItemId: string,
    userId: string,
    orders: { id: string; order: number }[],
  ): Promise<void> {
    await this.findOneOrFail(portfolioItemId, userId);
    for (const item of orders) {
      await this.filesRepository.update({ id: item.id, portfolioItemId }, { order: item.order });
    }
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 2;

    while (true) {
      const qb = this.portfolioRepository
        .createQueryBuilder('item')
        .where('item.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('item.id != :id', { id: excludeId });
      }
      const existing = await qb.getOne();
      if (!existing) break;
      slug = `${base}-${counter++}`;
    }

    return slug;
  }

  private async findOneOrFail(id: string, userId: string): Promise<PortfolioItem> {
    const item = await this.portfolioRepository.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!item) throw new NotFoundException('Item de portfólio não encontrado.');
    if (item.userId !== userId) throw new ForbiddenException('Acesso negado.');
    return item;
  }
}
