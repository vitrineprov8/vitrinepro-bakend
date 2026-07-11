import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PlanTier, User } from '../users/user.entity';
import { TeamMember, TeamMemberStatus, TeamRole } from '../teams/team-member.entity';
import { TeamContextHelper } from '../teams/team-context.helper';

/** Plans that unlock company/client management */
const COMPANY_ALLOWED_PLANS: PlanTier[] = [PlanTier.TEAM, PlanTier.ENTERPRISE];

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    @InjectRepository(TeamMember)
    private teamMembersRepository: Repository<TeamMember>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private teamContextHelper: TeamContextHelper,
  ) {}

  /**
   * Asserts that the QUOTA OWNER's plan allows company management.
   * Throws 403 with a clear message for lower-tier users.
   */
  private assertPlanAllowed(plan: PlanTier): void {
    if (!COMPANY_ALLOWED_PLANS.includes(plan)) {
      throw new ForbiddenException(
        'Recurso disponível apenas para planos Team e Enterprise.',
      );
    }
  }

  /**
   * Asserts that the actor is NOT a RECRUITER (write-blocked).
   * RECRUITER can read companies but cannot create, update, delete, or set recruiters.
   */
  private async assertNotRecruiter(actor: User): Promise<void> {
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    if (ctx.role === TeamRole.RECRUITER) {
      throw new ForbiddenException(
        'Recrutadores têm acesso somente leitura às empresas.',
      );
    }
  }

  /**
   * Lists companies visible to the authenticated user.
   *
   * Visibility rules:
   *  - OWNER or MANAGER (ACTIVE) → all companies where ownerId = team owner's id.
   *  - RECRUITER (ACTIVE)        → only companies where the actor is in assignedRecruiters.
   *  - Solo user with allowed plan → their own companies.
   */
  async listMine(actor: User): Promise<Company[]> {
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    const quotaOwner = ctx.quotaOwner;

    // Plan check against the effective owner
    this.assertPlanAllowed(quotaOwner.plan);

    if (ctx.role === TeamRole.RECRUITER) {
      // RECRUITER: only companies where they are in assignedRecruiters
      return this.companiesRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.assignedRecruiters', 'ar')
        .where('c.ownerId = :ownerId', { ownerId: quotaOwner.id })
        // Filter to companies where the recruiter is assigned
        .andWhere((qb) => {
          const sub = qb
            .subQuery()
            .select('cr.companyId')
            .from('company_recruiters', 'cr')
            .where('cr.userId = :recruiterId')
            .getQuery();
          return `c.id IN ${sub}`;
        })
        .setParameter('recruiterId', actor.id)
        .orderBy('c.createdAt', 'DESC')
        .getMany();
    }

    // OWNER or MANAGER: all companies owned by the quota owner
    return this.companiesRepository.find({
      where: { ownerId: quotaOwner.id },
      relations: ['assignedRecruiters'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Creates a new client company.
   *
   * RECRUITER: blocked (read-only).
   * OWNER/MANAGER: company is always owned by the QUOTA OWNER (team owner),
   *   regardless of which MANAGER triggered the creation.
   */
  async create(actor: User, dto: CreateCompanyDto): Promise<Company> {
    await this.assertNotRecruiter(actor);

    const ctx = await this.teamContextHelper.getTeamContext(actor);
    const quotaOwner = ctx.quotaOwner;

    this.assertPlanAllowed(quotaOwner.plan);

    const company = this.companiesRepository.create({
      name: dto.name,
      logoUrl: dto.logoUrl ?? null,
      industry: dto.industry ?? null,
      description: dto.description ?? null,
      website: dto.website ?? null,
      // Always owned by the team owner so company ownership is consistent
      ownerId: quotaOwner.id,
    });

    return this.companiesRepository.save(company);
  }

  /**
   * Returns a company by id, applying visibility rules.
   *
   * RECRUITER: must be in assignedRecruiters; otherwise 404.
   * OWNER/MANAGER: any company owned by the quota owner.
   */
  async findOne(id: string, actor: User): Promise<Company> {
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    const quotaOwner = ctx.quotaOwner;

    this.assertPlanAllowed(quotaOwner.plan);

    const company = await this.companiesRepository.findOne({
      where: { id },
      relations: ['assignedRecruiters'],
    });

    if (!company || company.ownerId !== quotaOwner.id) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    if (ctx.role === TeamRole.RECRUITER) {
      // RECRUITER can only see companies they are assigned to
      const isAssigned = company.assignedRecruiters.some((u) => u.id === actor.id);
      if (!isAssigned) {
        throw new NotFoundException('Empresa não encontrada.');
      }
    }

    return company;
  }

  /**
   * Replaces the set of recruiters assigned to a company.
   *
   * RECRUITER: blocked.
   * Each recruiterId must be an ACTIVE team member of the quota owner.
   */
  async setRecruiters(
    id: string,
    actor: User,
    recruiterIds: string[],
  ): Promise<Company> {
    await this.assertNotRecruiter(actor);

    const company = await this.findOne(id, actor);
    const ctx = await this.teamContextHelper.getTeamContext(actor);
    const quotaOwner = ctx.quotaOwner;

    if (recruiterIds.length === 0) {
      company.assignedRecruiters = [];
      return this.companiesRepository.save(company);
    }

    // Validate each recruiterId is an ACTIVE team member of the quota owner
    const members = await this.teamMembersRepository.find({
      where: {
        userId: In(recruiterIds),
        status: TeamMemberStatus.ACTIVE,
        team: { ownerId: quotaOwner.id },
      },
      relations: ['team'],
    });
    const validIds = new Set(members.map((m) => m.userId).filter(Boolean) as string[]);
    const invalid = recruiterIds.filter((rid) => !validIds.has(rid));
    if (invalid.length > 0) {
      throw new ForbiddenException('Um ou mais recrutadores não pertencem ao time.');
    }

    const users = await this.usersRepository.find({ where: { id: In(recruiterIds) } });
    company.assignedRecruiters = users;
    return this.companiesRepository.save(company);
  }

  /**
   * Updates a company's fields.
   *
   * RECRUITER: blocked.
   * OWNER/MANAGER: allowed if the company belongs to the quota owner.
   */
  async update(
    id: string,
    actor: User,
    dto: UpdateCompanyDto,
  ): Promise<Company> {
    await this.assertNotRecruiter(actor);

    const company = await this.findOne(id, actor);

    Object.assign(company, {
      name: dto.name ?? company.name,
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : company.logoUrl,
      industry: dto.industry !== undefined ? dto.industry : company.industry,
      description: dto.description !== undefined ? dto.description : company.description,
      website: dto.website !== undefined ? dto.website : company.website,
    });

    return this.companiesRepository.save(company);
  }

  /**
   * Removes a company.
   *
   * RECRUITER: blocked.
   * OWNER/MANAGER: allowed if the company belongs to the quota owner.
   */
  async remove(id: string, actor: User): Promise<void> {
    await this.assertNotRecruiter(actor);
    const company = await this.findOne(id, actor);
    await this.companiesRepository.remove(company);
  }
}
