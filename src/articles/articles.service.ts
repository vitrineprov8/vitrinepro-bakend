import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ArticleStatus } from './article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { TagsService } from '../tags/tags.service';
import { StorageService } from '../storage/storage.service';
import { paginate } from '../common/paginate.helper';
import slugify from 'slugify';

function extractTextFromTiptap(content: any): string {
  if (!content || typeof content !== 'object') return '';
  let text = '';
  if (content.text) text += content.text + ' ';
  if (Array.isArray(content.content)) {
    for (const node of content.content) {
      text += extractTextFromTiptap(node);
    }
  }
  return text;
}

function calculateReadTime(content: object): number {
  const text = extractTextFromTiptap(content);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private articlesRepository: Repository<Article>,
    private tagsService: TagsService,
    private storageService: StorageService,
  ) {}

  async findAll(dto: ListArticlesDto) {
    const { page = 1, limit = 10, tag, userId, status } = dto;

    const qb = this.articlesRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.tags', 'tag')
      .leftJoin('article.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.avatarUrl', 'user.profession', 'user.username'])
      .orderBy('article.publishedAt', 'DESC')
      .addOrderBy('article.createdAt', 'DESC');

    if (status) {
      qb.andWhere('article.status = :status', { status });
    } else {
      qb.andWhere('article.status = :status', { status: ArticleStatus.PUBLISHED });
    }

    if (tag) {
      qb.andWhere('tag.slug = :tag', { tag });
    }

    if (userId) {
      qb.andWhere('article.userId = :userId', { userId });
    }

    const result = await paginate(qb, page, limit);

    return {
      ...result,
      data: result.data.map((a) => ({
        id: a.id,
        title: a.title,
        subtitle: a.subtitle,
        slug: a.slug,
        coverImageUrl: a.coverImageUrl,
        readTime: a.readTime,
        tags: a.tags,
        publishedAt: a.publishedAt,
        author: (a as any).user,
      })),
    };
  }

  async findBySlug(slug: string, userId?: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      relations: ['tags', 'user'],
    });
    if (!article) throw new NotFoundException('Artigo não encontrado.');
    if (article.status !== ArticleStatus.PUBLISHED && article.userId !== userId) {
      throw new ForbiddenException('Artigo não disponível.');
    }
    return article;
  }

  async create(userId: string, dto: CreateArticleDto): Promise<Article> {
    const slug = await this.generateUniqueSlug(dto.title);
    const tags = dto.tagIds ? await this.tagsService.findByIds(dto.tagIds) : [];
    const content = dto.content || {};
    const readTime = calculateReadTime(content);

    const article = this.articlesRepository.create({
      userId,
      title: dto.title,
      subtitle: dto.subtitle,
      slug,
      content,
      conclusion: dto.conclusion,
      readTime,
      status: dto.status || ArticleStatus.DRAFT,
      tags,
      publishedAt: dto.status === ArticleStatus.PUBLISHED ? new Date() : null,
    });

    return this.articlesRepository.save(article);
  }

  async update(id: string, userId: string, dto: UpdateArticleDto): Promise<Article> {
    const article = await this.findOneOrFail(id, userId);

    if (dto.title && dto.title !== article.title) {
      article.slug = await this.generateUniqueSlug(dto.title, id);
    }

    if (dto.tagIds !== undefined) {
      article.tags = await this.tagsService.findByIds(dto.tagIds);
    }

    if (dto.content !== undefined) {
      article.content = dto.content;
      article.readTime = calculateReadTime(dto.content);
    }

    if (dto.status === ArticleStatus.PUBLISHED && article.status !== ArticleStatus.PUBLISHED) {
      article.publishedAt = new Date();
    }

    Object.assign(article, {
      title: dto.title ?? article.title,
      subtitle: dto.subtitle ?? article.subtitle,
      conclusion: dto.conclusion ?? article.conclusion,
      status: dto.status ?? article.status,
    });

    return this.articlesRepository.save(article);
  }

  async delete(id: string, userId: string): Promise<void> {
    const article = await this.findOneOrFail(id, userId);
    if (article.coverImageKey) {
      await this.storageService.deleteFile(article.coverImageKey);
    }
    await this.articlesRepository.remove(article);
  }

  async uploadCover(id: string, userId: string, file: Express.Multer.File): Promise<Article> {
    const article = await this.findOneOrFail(id, userId);
    this.storageService.validateImage(file.buffer, file.mimetype);

    if (article.coverImageKey) {
      await this.storageService.deleteFile(article.coverImageKey);
    }

    const processed = await this.storageService.processImage(file.buffer, 'cover');
    const key = `articles/covers/${id}.webp`;
    const url = await this.storageService.uploadFile(processed, key, 'image/webp');

    article.coverImageUrl = url;
    article.coverImageKey = key;
    return this.articlesRepository.save(article);
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 2;

    while (true) {
      const qb = this.articlesRepository
        .createQueryBuilder('article')
        .where('article.slug = :slug', { slug });
      if (excludeId) {
        qb.andWhere('article.id != :id', { id: excludeId });
      }
      const existing = await qb.getOne();
      if (!existing) break;
      slug = `${base}-${counter++}`;
    }

    return slug;
  }

  private async findOneOrFail(id: string, userId: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!article) throw new NotFoundException('Artigo não encontrado.');
    if (article.userId !== userId) throw new ForbiddenException('Acesso negado.');
    return article;
  }
}
