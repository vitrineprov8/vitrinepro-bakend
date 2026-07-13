import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PortfolioItem, PortfolioStatus } from './portfolio.entity';
import { PortfolioFile, PortfolioFileType } from './portfolio-file.entity';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { ListPortfolioDto } from './dto/list-portfolio.dto';
import { TagsService } from '../tags/tags.service';
import { StorageService } from '../storage/storage.service';
import { SeoService } from '../seo/seo.service';
import { TombstoneType, TombstoneReason } from '../seo/slug-tombstone.entity';
import { paginate } from '../common/paginate.helper';
import slugify from 'slugify';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectRepository(PortfolioItem)
    private portfolioRepository: Repository<PortfolioItem>,
    @InjectRepository(PortfolioFile)
    private filesRepository: Repository<PortfolioFile>,
    private tagsService: TagsService,
    private storageService: StorageService,
    private seoService: SeoService,
    private dataSource: DataSource,
  ) {}

  async findAll(dto: ListPortfolioDto, requesterId?: string) {
    const { page = 1, limit = 10, tag, userId, status } = dto;

    // T-C07 — este endpoint é público (OptionalJwtAuthGuard, sem auth
    // obrigatória). Antes, `status=DRAFT&userId=<qualquer-id>` vazava itens
    // não publicados de QUALQUER usuário para QUALQUER visitante (nenhuma
    // verificação de dono). `isOwnerQuery` restringe a visão de status
    // não-PUBLISHED a quando o requisitante autenticado é o próprio dono —
    // é também o que permite ao candidato listar seu próprio portfólio
        // completo (rascunhos + publicados) via GET /portfolio?userId=<próprio id>.
    const isOwnerQuery = !!userId && !!requesterId && userId === requesterId;

    const qb = this.portfolioRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.tags', 'tag')
      .leftJoin('item.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.avatarUrl', 'user.profession', 'user.username'])
      .orderBy('item.createdAt', 'DESC');

    if (status) {
      if (status !== PortfolioStatus.PUBLISHED && !isOwnerQuery) {
        throw new ForbiddenException('Não é possível listar itens não publicados de outro usuário.');
      }
      qb.andWhere('item.status = :status', { status });
    } else if (!isOwnerQuery) {
      qb.andWhere('item.status = :status', { status: PortfolioStatus.PUBLISHED });
    }
    // else: isOwnerQuery && sem status explícito → devolve todos os status (lista própria completa).

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
        isFeatured: item.isFeatured,
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
    // F7/gap novo — este endpoint é público (OptionalJwtAuthGuard, sem auth
    // obrigatória), mas a relation `user` trazia a entidade crua com o hash
    // de `password` (mesma classe de bug do B19, aqui ainda mais grave por
    // não exigir autenticação nenhuma). Remove os campos sensíveis antes de
    // devolver — mantém só o necessário para exibir o autor do item.
    if (item.user) {
      const { password, oauthId, avatarKey, bannerKey, passwordResetToken, passwordResetExpiresAt, ...safeUser } =
        item.user as any;
      item.user = safeUser;
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
    // Resolve slug and tags outside the transaction (both are read-only lookups).
    const item = await this.findOneOrFail(id, userId);

    // Track fields before mutation for SEO side-effects.
    const oldSlug = item.slug;
    const oldStatus = item.status;

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
      isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : item.isFeatured,
    });

    // Business rule: only one featured item is allowed per user at a time.
    // When isFeatured is being set to true, clear the flag on all sibling items
    // atomically in a single transaction to prevent race conditions.
    let savedItem: PortfolioItem;
    if (dto.isFeatured === true) {
      savedItem = await this.dataSource.transaction(async (manager) => {
        // Unset isFeatured on every OTHER item owned by this user.
        await manager
          .createQueryBuilder()
          .update(PortfolioItem)
          .set({ isFeatured: false })
          .where('"userId" = :userId AND id != :id', { userId, id })
          .execute();

        return manager.save(PortfolioItem, item);
      });
    } else {
      savedItem = await this.portfolioRepository.save(item);
    }

    // If the slug changed, register a tombstone so the old URL gets a 301
    // instead of a 404 or soft-404. Fire-and-forget — SEO is non-critical and
    // must not break a successful update.
    if (item.slug !== oldSlug) {
      this.seoService
        .createTombstone({
          type: TombstoneType.PORTFOLIO,
          slug: oldSlug,
          reason: TombstoneReason.RENAMED,
          redirectTo: `/portfolio/${item.slug}`,
        })
        .then(() => {
          // Also clear any stale tombstone pointing to the new slug
          // (handles the edge case where the user reverted to an old slug).
          return this.seoService.removeTombstone(
            TombstoneType.PORTFOLIO,
            item.slug,
          );
        })
        .catch((err) =>
          this.logger.error(
            `Failed to create renamed tombstone for slug "${oldSlug}" → "${item.slug}"`,
            err,
          ),
        );

      // Notify search engines about both the old (gone) and new (live) URLs.
      void this.seoService.notifyIndexNow([
        `/portfolio/${oldSlug}`,
        `/portfolio/${item.slug}`,
      ]);
    }

    // Notify when item transitions to PUBLISHED for the first time.
    // oldStatus tracks what the status was before Object.assign so we only
    // ping on an actual DRAFT/CLOSED → PUBLISHED transition, not on every save.
    const becamePublished =
      oldStatus !== PortfolioStatus.PUBLISHED &&
      savedItem.status === PortfolioStatus.PUBLISHED;
    if (becamePublished) {
      void this.seoService.notifyIndexNow(`/portfolio/${savedItem.slug}`);
    }

    return savedItem;
  }

  async delete(id: string, userId: string): Promise<void> {
    const item = await this.findOneOrFail(id, userId);

    // Capture the slug BEFORE remove() cascades and the entity is gone.
    // The tombstone only matters for PUBLISHED items (those have been indexed),
    // but we record it regardless — a DRAFT tombstone is harmless and costs
    // essentially nothing at lookup time (partial index filters them the same).
    const slugToTombstone = item.slug;

    if (item.coverImageKey) {
      await this.storageService.deleteFile(item.coverImageKey);
    }

    const files = await this.filesRepository.find({ where: { portfolioItemId: id } });
    for (const file of files) {
      await this.storageService.deleteFile(file.fileKey);
    }

    await this.portfolioRepository.remove(item);

    // Register tombstone after successful delete. Fire-and-forget — SEO is
    // non-critical and must not roll back an already-committed deletion.
    this.seoService
      .createTombstone({
        type: TombstoneType.PORTFOLIO,
        slug: slugToTombstone,
        reason: TombstoneReason.DELETED,
      })
      .catch((err) =>
        this.logger.error(
          `Failed to create tombstone for deleted portfolio slug "${slugToTombstone}"`,
          err,
        ),
      );

    // Notify IndexNow so Bing/Yandex deindex the URL within hours.
    void this.seoService.notifyIndexNow(`/portfolio/${slugToTombstone}`);
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

    const saved = await this.filesRepository.save(portfolioFile);

    // Se é IMAGEM e ainda não existe coverImageUrl, usar esta como capa do item
    // (primeira foto da galeria = capa, conforme feedback do cliente).
    if (fileType === PortfolioFileType.IMAGE && !item.coverImageUrl) {
      item.coverImageUrl = fileUrl;
      await this.portfolioRepository.save(item);
    }

    return saved;
  }

  async deleteFile(portfolioItemId: string, fileId: string, userId: string): Promise<void> {
    const item = await this.findOneOrFail(portfolioItemId, userId);
    const file = await this.filesRepository.findOne({ where: { id: fileId, portfolioItemId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado.');
    await this.storageService.deleteFile(file.fileKey);
    await this.filesRepository.remove(file);

    // Se o arquivo removido era a capa, promover a próxima imagem (ordem ASC) ou limpar.
    if (file.fileUrl === item.coverImageUrl) {
      const nextImage = await this.filesRepository.findOne({
        where: { portfolioItemId, fileType: PortfolioFileType.IMAGE },
        order: { order: 'ASC' },
      });
      item.coverImageUrl = nextImage?.fileUrl ?? null;
      await this.portfolioRepository.save(item);
    }
  }

  async reorderFiles(
    portfolioItemId: string,
    userId: string,
    orders: { id: string; order: number }[],
  ): Promise<void> {
    const item = await this.findOneOrFail(portfolioItemId, userId);
    for (const order of orders) {
      await this.filesRepository.update({ id: order.id, portfolioItemId }, { order: order.order });
    }

    // Após reordenar, a capa deve refletir a primeira IMAGEM na nova ordem.
    const firstImage = await this.filesRepository.findOne({
      where: { portfolioItemId, fileType: PortfolioFileType.IMAGE },
      order: { order: 'ASC' },
    });
    if (firstImage && firstImage.fileUrl !== item.coverImageUrl) {
      item.coverImageUrl = firstImage.fileUrl;
      await this.portfolioRepository.save(item);
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
