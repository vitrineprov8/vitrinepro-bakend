import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SavedFilter } from './saved-filter.entity';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { UpdateSavedFilterDto } from './dto/update-saved-filter.dto';

@Injectable()
export class SavedFiltersService {
  constructor(
    @InjectRepository(SavedFilter)
    private savedFiltersRepository: Repository<SavedFilter>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateSavedFilterDto): Promise<SavedFilter> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SavedFilter);

      // If the new filter should be default, unset any existing default first
      if (dto.isDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      }

      const filter = repo.create({
        userId,
        name: dto.name,
        filters: dto.filters,
        isDefault: dto.isDefault ?? false,
        position: dto.position ?? 0,
      });

      return repo.save(filter);
    });
  }

  async listMine(userId: string): Promise<SavedFilter[]> {
    return this.savedFiltersRepository.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
      select: ['id', 'name', 'filters', 'isDefault', 'position', 'createdAt'],
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateSavedFilterDto,
  ): Promise<SavedFilter> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SavedFilter);
      const filter = await repo.findOne({ where: { id } });
      if (!filter) throw new NotFoundException('Filtro não encontrado.');
      if (filter.userId !== userId) {
        throw new ForbiddenException('Você não tem acesso a este filtro.');
      }

      // If setting this as default, clear the previous one
      if (dto.isDefault && !filter.isDefault) {
        await repo.update({ userId, isDefault: true }, { isDefault: false });
      }

      Object.assign(filter, {
        name: dto.name !== undefined ? dto.name : filter.name,
        filters: dto.filters !== undefined ? dto.filters : filter.filters,
        isDefault: dto.isDefault !== undefined ? dto.isDefault : filter.isDefault,
        position: dto.position !== undefined ? dto.position : filter.position,
      });

      return repo.save(filter);
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const filter = await this.savedFiltersRepository.findOne({ where: { id } });
    if (!filter) throw new NotFoundException('Filtro não encontrado.');
    if (filter.userId !== userId) {
      throw new ForbiddenException('Você não tem acesso a este filtro.');
    }
    await this.savedFiltersRepository.remove(filter);
  }

  /**
   * Sets the specified filter as default and clears the flag on all others
   * belonging to the same user. Wrapped in a transaction for atomicity.
   */
  async setDefault(id: string, userId: string): Promise<SavedFilter> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SavedFilter);

      const filter = await repo.findOne({ where: { id } });
      if (!filter) throw new NotFoundException('Filtro não encontrado.');
      if (filter.userId !== userId) {
        throw new ForbiddenException('Você não tem acesso a este filtro.');
      }

      // Clear all defaults for this user, then set the target one
      await repo.update({ userId, isDefault: true }, { isDefault: false });
      filter.isDefault = true;
      return repo.save(filter);
    });
  }
}
