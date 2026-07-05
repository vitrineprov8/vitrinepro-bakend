import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { User } from '../users/user.entity';

export interface HomeStats {
  /** Vagas PUBLISHED e não expiradas. */
  openVagas: number;
  /** Contas de profissionais (não-empresa). */
  professionals: number;
  /** Contas de empresa. */
  companies: number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Vaga)
    private readonly vagasRepository: Repository<Vaga>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Contadores públicos para a Home (gap B12 — parcial).
   *
   * Apenas métricas calculáveis a partir do schema atual.
   * Fees pagos / placements / hunters verificados dependem de B9/B11/B8 e
   * ainda não existem — o frontend cobre essas com mock.
   */
  async home(): Promise<HomeStats> {
    const [openVagas, professionals, companies] = await Promise.all([
      this.vagasRepository
        .createQueryBuilder('vaga')
        .where('vaga.status = :status', { status: VagaStatus.PUBLISHED })
        .andWhere('(vaga.deadline IS NULL OR vaga.deadline > NOW())')
        .getCount(),
      this.usersRepository.count({ where: { isCompany: false } }),
      this.usersRepository.count({ where: { isCompany: true } }),
    ]);

    return { openVagas, professionals, companies };
  }
}
