import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedVaga } from './saved-vaga.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { paginate, PaginatedResult } from '../common/paginate.helper';
import { PaginationDto } from '../common/pagination.dto';

@Injectable()
export class SavedVagasService {
  constructor(
    @InjectRepository(SavedVaga)
    private savedVagasRepository: Repository<SavedVaga>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
  ) {}

  /** Save a published vaga for the authenticated user. Idempotent via unique constraint. */
  async save(userId: string, vagaId: string): Promise<SavedVaga> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'status'],
    });
    if (!vaga || vaga.status !== VagaStatus.PUBLISHED) {
      throw new NotFoundException('Vaga não encontrada ou não está publicada.');
    }

    const existing = await this.savedVagasRepository.findOne({
      where: { userId, vagaId },
    });
    if (existing) {
      throw new ConflictException('Vaga já está salva.');
    }

    const saved = this.savedVagasRepository.create({ userId, vagaId });
    return this.savedVagasRepository.save(saved);
  }

  /** Remove a saved vaga bookmark. */
  async unsave(userId: string, vagaId: string): Promise<void> {
    const existing = await this.savedVagasRepository.findOne({
      where: { userId, vagaId },
    });
    if (!existing) {
      throw new NotFoundException('Vaga não está nos salvos.');
    }
    await this.savedVagasRepository.remove(existing);
  }

  /** List saved vagas for the authenticated user, with vaga details joined. */
  async listMine(
    userId: string,
    dto: PaginationDto,
  ): Promise<PaginatedResult<SavedVaga>> {
    const { page = 1, limit = 10 } = dto;

    const qb = this.savedVagasRepository
      .createQueryBuilder('sv')
      .innerJoinAndSelect('sv.vaga', 'vaga')
      .where('sv.userId = :userId', { userId })
      // T-C05 — inclui vagas fechadas/despublicadas: o frontend usa isso para a
      // aba "Encerradas" (cards acinzentados, ação única: remover). Antes este
      // filtro escondia essas vagas por completo da lista de salvos.
      .orderBy('sv.createdAt', 'DESC');

    return paginate(qb, page, limit);
  }
}
