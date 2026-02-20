import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

  async findAll(): Promise<Tag[]> {
    return this.tagsRepository.find({ order: { name: 'ASC' } });
  }

  async create(name: string): Promise<Tag> {
    const slug = slugify(name, { lower: true, strict: true });
    const existing = await this.tagsRepository.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(`Tag "${name}" já existe.`);
    }
    const tag = this.tagsRepository.create({ name, slug });
    return this.tagsRepository.save(tag);
  }

  async delete(id: string): Promise<void> {
    const tag = await this.tagsRepository.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Tag não encontrada.');
    await this.tagsRepository.remove(tag);
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    if (!ids || ids.length === 0) return [];
    return this.tagsRepository.findByIds(ids);
  }
}
