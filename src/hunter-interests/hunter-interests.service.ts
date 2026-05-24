import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HunterInterest, HunterInterestStatus } from './hunter-interest.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { User, UserRole } from '../users/user.entity';
import { UpdateHunterInterestDto } from './dto/update-hunter-interest.dto';

@Injectable()
export class HunterInterestsService {
  constructor(
    @InjectRepository(HunterInterest)
    private hunterInterestsRepository: Repository<HunterInterest>,
    @InjectRepository(Vaga)
    private vagasRepository: Repository<Vaga>,
  ) {}

  /**
   * Registers a hunter's interest in a vaga.
   *
   * Rules:
   *  - Vaga must be PUBLISHED and have allowHunters = true.
   *  - The user must not be the vaga creator (cannot express interest in own vaga).
   *  - Unique constraint prevents duplicates; 409 if already registered.
   */
  async express(vagaId: string, hunterUser: User): Promise<HunterInterest> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'status', 'allowHunters', 'createdById'],
    });

    if (!vaga || vaga.status !== VagaStatus.PUBLISHED) {
      throw new NotFoundException('Vaga não encontrada.');
    }

    if (!vaga.allowHunters) {
      throw new ForbiddenException('Esta vaga não aceita hunters externos.');
    }

    if (vaga.createdById === hunterUser.id) {
      throw new ForbiddenException('Você não pode se registrar como hunter na própria vaga.');
    }

    const existing = await this.hunterInterestsRepository.findOne({
      where: { vagaId, hunterUserId: hunterUser.id },
    });
    if (existing) {
      throw new ConflictException('Você já registrou interesse nesta vaga como hunter.');
    }

    const interest = this.hunterInterestsRepository.create({
      vagaId,
      hunterUserId: hunterUser.id,
      status: HunterInterestStatus.PENDING,
    });

    return this.hunterInterestsRepository.save(interest);
  }

  /**
   * Lists all hunter interests for the authenticated user.
   * Joins vaga data (title, segment) and includes contact info if ACCEPTED.
   */
  async listMine(hunterUserId: string): Promise<unknown[]> {
    const interests = await this.hunterInterestsRepository
      .createQueryBuilder('hi')
      .innerJoinAndSelect('hi.vaga', 'vaga')
      .where('hi.hunterUserId = :hunterUserId', { hunterUserId })
      .orderBy('hi.createdAt', 'DESC')
      .getMany();

    return interests.map((hi) => ({
      id: hi.id,
      status: hi.status,
      createdAt: hi.createdAt,
      vaga: hi.vaga
        ? {
            id: hi.vaga.id,
            title: hi.vaga.title,
            slug: hi.vaga.slug,
            segment: hi.vaga.segment,
            status: hi.vaga.status,
            location: hi.vaga.location,
            // Only expose the contact phone if the owner has accepted this hunter
            hunterContactPhone:
              hi.status === HunterInterestStatus.ACCEPTED
                ? hi.vaga.hunterContactPhone
                : null,
            contactEmail:
              hi.status === HunterInterestStatus.ACCEPTED
                ? hi.vaga.contactEmail
                : null,
          }
        : null,
    }));
  }

  /**
   * Lists all hunters who expressed interest in a vaga.
   * Only the vaga owner (or admin) can call this endpoint.
   * Returns hunter name, email, phone for direct contact.
   */
  async listByVaga(
    vagaId: string,
    actor: User,
  ): Promise<unknown[]> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'createdById'],
    });

    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    if (vaga.createdById !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para ver os hunters desta vaga.',
      );
    }

    const interests = await this.hunterInterestsRepository
      .createQueryBuilder('hi')
      .innerJoinAndSelect('hi.hunterUser', 'hunter')
      .where('hi.vagaId = :vagaId', { vagaId })
      .orderBy('hi.createdAt', 'DESC')
      .getMany();

    return interests.map((hi) => ({
      id: hi.id,
      status: hi.status,
      createdAt: hi.createdAt,
      hunter: hi.hunterUser
        ? {
            id: hi.hunterUser.id,
            firstName: hi.hunterUser.firstName,
            lastName: hi.hunterUser.lastName,
            email: hi.hunterUser.email,
            phone: hi.hunterUser.phone,
            username: hi.hunterUser.username,
            avatarUrl: hi.hunterUser.avatarUrl,
          }
        : null,
    }));
  }

  /**
   * Accepts or rejects a hunter interest.
   * Only the vaga owner (or admin) can update the status.
   * PENDING → ACCEPTED or REJECTED only.
   */
  async updateStatus(
    vagaId: string,
    hunterUserId: string,
    dto: UpdateHunterInterestDto,
    actor: User,
  ): Promise<HunterInterest> {
    const vaga = await this.vagasRepository.findOne({
      where: { id: vagaId },
      select: ['id', 'createdById'],
    });

    if (!vaga) throw new NotFoundException('Vaga não encontrada.');

    if (vaga.createdById !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar hunters desta vaga.',
      );
    }

    const interest = await this.hunterInterestsRepository.findOne({
      where: { vagaId, hunterUserId },
    });

    if (!interest) {
      throw new NotFoundException('Interesse de hunter não encontrado.');
    }

    interest.status = dto.status;
    return this.hunterInterestsRepository.save(interest);
  }
}
