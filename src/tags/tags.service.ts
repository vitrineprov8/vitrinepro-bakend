import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './tag.entity';
import slugify from 'slugify';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private tagsRepository: Repository<Tag>,
  ) {}

  async findAll(userId: string): Promise<Tag[]> {
    return this.tagsRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async create(userId: string, name: string): Promise<Tag> {
    const slug = slugify(name, { lower: true, strict: true });
    const existing = await this.tagsRepository.findOne({ where: { userId, slug } });
    if (existing) {
      throw new BadRequestException(`Tag "${name}" já existe.`);
    }
    const tag = this.tagsRepository.create({ userId, name, slug });
    return this.tagsRepository.save(tag);
  }

  async delete(id: string, userId: string): Promise<void> {
    const tag = await this.tagsRepository.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Tag não encontrada.');
    if (tag.userId !== userId) throw new ForbiddenException('Acesso negado.');
    await this.tagsRepository.remove(tag);
  }

  async findByIds(ids: string[], userId: string): Promise<Tag[]> {
    if (!ids || ids.length === 0) return [];
    const tags = await this.tagsRepository
      .createQueryBuilder('tag')
      .where('tag.id IN (:...ids)', { ids })
      .andWhere('tag.userId = :userId', { userId })
      .getMany();
    return tags;
  }

  async createDefaultTagsForUser(userId: string): Promise<void> {
    const defaults = [
      { name: 'Artigo', slug: 'artigo' },
      { name: 'Projeto', slug: 'projeto' },
    ];
    for (const d of defaults) {
      const exists = await this.tagsRepository.findOne({ where: { userId, slug: d.slug } });
      if (!exists) {
        const tag = this.tagsRepository.create({ userId, name: d.name, slug: d.slug });
        await this.tagsRepository.save(tag);
      }
    }
  }
}
