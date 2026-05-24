import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from './team.entity';
import { TeamMember, TeamMemberStatus, TeamRole } from './team-member.entity';
import { User, PlanTier } from '../users/user.entity';
import { PLAN_SEAT_LIMITS } from '../plans/plan-limits';
import { TeamContextHelper } from './team-context.helper';

/** Plans that unlock multi-user team functionality */
const TEAM_ALLOWED_PLANS: PlanTier[] = [PlanTier.TEAM, PlanTier.ENTERPRISE];

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMembersRepository: Repository<TeamMember>,
    private teamContextHelper: TeamContextHelper,
  ) {}

  /**
   * Throws ForbiddenException unless `actor` is the team OWNER or an ACTIVE
   * MANAGER of `team`.  Used to gate invite, removeMember (for RECRUITERs),
   * and setRecruiters operations.
   */
  private async assertOwnerOrManager(team: Team, actor: User): Promise<void> {
    const allowed = await this.teamContextHelper.isOwnerOrManager(team, actor);
    if (!allowed) {
      throw new ForbiddenException(
        'Apenas o proprietário ou gerente do time podem realizar esta ação.',
      );
    }
  }

  /**
   * Returns the team context for the given user:
   *  1. If the user is the OWNER of a team → return that team.
   *  2. If the user is an ACTIVE member of any team → return that team.
   *  3. Otherwise, if the user has a TEAM or ENTERPRISE plan → create a new team
   *     seeded with the OWNER member row.
   *  4. If the user is on FREE or RECRUITER → throw 403 PLAN_TIER_REQUIRED.
   */
  async getOrCreateForUser(user: User): Promise<Team> {
    // 1. Check if user owns a team
    const ownedTeam = await this.teamsRepository.findOne({
      where: { ownerId: user.id },
      relations: ['members'],
    });
    if (ownedTeam) return ownedTeam;

    // 2. Check if user is an ACTIVE member of any team
    const activeMembership = await this.teamMembersRepository.findOne({
      where: { userId: user.id, status: TeamMemberStatus.ACTIVE },
      relations: ['team', 'team.members'],
    });
    if (activeMembership?.team) return activeMembership.team;

    // 3. Create team if plan allows
    if (!TEAM_ALLOWED_PLANS.includes(user.plan)) {
      throw new ForbiddenException({
        code: 'PLAN_TIER_REQUIRED',
        requiredTiers: ['TEAM', 'ENTERPRISE'],
        message: 'Funcionalidade disponível apenas para planos Team e Enterprise.',
      });
    }

    // Create team with the user as owner
    const team = await this.teamsRepository.save(
      this.teamsRepository.create({
        name: `Time de ${user.firstName ?? user.email}`,
        ownerId: user.id,
      }),
    );

    // Create the OWNER member row (ACTIVE immediately — no invite needed)
    await this.teamMembersRepository.save(
      this.teamMembersRepository.create({
        teamId: team.id,
        userId: user.id,
        invitedEmail: null,
        role: TeamRole.OWNER,
        status: TeamMemberStatus.ACTIVE,
      }),
    );

    return this.teamsRepository.findOne({
      where: { id: team.id },
      relations: ['members'],
    }) as Promise<Team>;
  }

  /**
   * Returns ALL teams accessible to the user: the one they own (if any) +
   * every team they are an ACTIVE member of. Used by the multi-context
   * switcher when a recruiter has been invited by multiple companies.
   *
   * Each entry includes the user's role inside that team.
   */
  async listAccessibleTeams(
    user: User,
  ): Promise<Array<{ id: string; name: string; ownerId: string; role: TeamRole }>> {
    const results = new Map<string, { id: string; name: string; ownerId: string; role: TeamRole }>();

    // Owned team
    const ownedTeam = await this.teamsRepository.findOne({
      where: { ownerId: user.id },
    });
    if (ownedTeam) {
      results.set(ownedTeam.id, {
        id: ownedTeam.id,
        name: ownedTeam.name,
        ownerId: ownedTeam.ownerId,
        role: TeamRole.OWNER,
      });
    }

    // Teams where user is an ACTIVE member (non-OWNER row)
    const memberships = await this.teamMembersRepository
      .createQueryBuilder('tm')
      .innerJoinAndSelect('tm.team', 'team')
      .where('tm.userId = :userId', { userId: user.id })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .andWhere('tm.role != :ownerRole', { ownerRole: TeamRole.OWNER })
      .getMany();

    for (const m of memberships) {
      if (m.team && !results.has(m.team.id)) {
        results.set(m.team.id, {
          id: m.team.id,
          name: m.team.name,
          ownerId: m.team.ownerId,
          role: m.role,
        });
      }
    }

    return Array.from(results.values());
  }

  /**
   * Invites a new member to the user's team by email.
   *
   * Authorisation: only OWNER or MANAGER members can invite.
   * Seat limit: enforced against PLAN_SEAT_LIMITS; -1 = unlimited.
   */
  async invite(
    actor: User,
    dto: { email: string; role: TeamRole },
  ): Promise<TeamMember> {
    const team = await this.getOrCreateForUser(actor);

    // Assert actor is OWNER or MANAGER (delegates to TeamContextHelper)
    await this.assertOwnerOrManager(team, actor);

    // Seat limit check — always charged against the team owner's plan.
    // getOrCreateForUser guarantees `team` has ownerId set; load owner if actor
    // is a MANAGER (so we read the right plan tier).
    const teamWithOwner = await this.teamsRepository.findOne({
      where: { id: team.id },
      relations: ['owner'],
    });
    const ownerPlan: PlanTier = teamWithOwner?.owner?.plan ?? actor.plan;
    const limit = PLAN_SEAT_LIMITS[ownerPlan];
    if (limit !== -1) {
      const usedCount = await this.teamMembersRepository.count({
        where: {
          teamId: team.id,
          status: In([TeamMemberStatus.ACTIVE, TeamMemberStatus.PENDING]),
        },
      });
      if (usedCount >= limit) {
        throw new ForbiddenException({
          code: 'SEAT_LIMIT_REACHED',
          used: usedCount,
          limit,
          message: 'Limite de vagas do time atingido. Faça upgrade para adicionar mais membros.',
        });
      }
    }

    // Prevent duplicate invites for the same email in this team
    const duplicate = await this.teamMembersRepository.findOne({
      where: { teamId: team.id, invitedEmail: dto.email },
    });
    if (duplicate) {
      throw new ForbiddenException('Este e-mail já foi convidado para o time.');
    }

    const member = this.teamMembersRepository.create({
      teamId: team.id,
      userId: null,
      invitedEmail: dto.email,
      role: dto.role,
      status: TeamMemberStatus.PENDING,
    });

    return this.teamMembersRepository.save(member);
  }

  /**
   * Accepts an invite on behalf of the authenticated user.
   *
   * Matches on memberId + invitedEmail === user.email.
   * Marks the member ACTIVE and links their userId.
   */
  async acceptInvite(user: User, memberId: string): Promise<TeamMember> {
    const member = await this.teamMembersRepository.findOne({
      where: { id: memberId },
    });

    if (!member) throw new NotFoundException('Convite não encontrado.');

    if (!member.invitedEmail || member.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException('Este convite não pertence ao seu e-mail.');
    }

    if (member.status === TeamMemberStatus.ACTIVE) {
      throw new ForbiddenException('Convite já foi aceito.');
    }

    member.userId = user.id;
    member.status = TeamMemberStatus.ACTIVE;

    return this.teamMembersRepository.save(member);
  }

  /**
   * Removes a member from the team.
   *
   * Permission matrix:
   *  - OWNER  → can remove any MANAGER or RECRUITER row.
   *  - MANAGER → can remove RECRUITER rows only; cannot remove OWNER or other MANAGERs.
   *  - RECRUITER → cannot remove anyone.
   *
   * Neither OWNER nor MANAGER rows can be self-removed (use team dissolution for that).
   */
  async removeMember(actor: User, memberId: string): Promise<void> {
    const team = await this.getOrCreateForUser(actor);

    // Resolve actor's role in this team
    const actorMember = await this.teamMembersRepository.findOne({
      where: { teamId: team.id, userId: actor.id, status: TeamMemberStatus.ACTIVE },
    });

    const actorIsOwner = actorMember?.role === TeamRole.OWNER;
    const actorIsManager = actorMember?.role === TeamRole.MANAGER;

    if (!actorIsOwner && !actorIsManager) {
      throw new ForbiddenException(
        'Apenas o proprietário ou gerente podem remover membros.',
      );
    }

    const target = await this.teamMembersRepository.findOne({
      where: { id: memberId, teamId: team.id },
    });
    if (!target) throw new NotFoundException('Membro não encontrado.');

    // Nobody can remove the OWNER row
    if (target.role === TeamRole.OWNER) {
      throw new ForbiddenException('Não é possível remover o proprietário do time.');
    }

    // MANAGER can only remove RECRUITERs — not other MANAGERs
    if (actorIsManager && target.role === TeamRole.MANAGER) {
      throw new ForbiddenException(
        'Gerentes podem remover apenas recrutadores. Somente o proprietário pode remover outros gerentes.',
      );
    }

    await this.teamMembersRepository.remove(target);
  }

  /**
   * Updates the role of a team member.
   *
   * Only the OWNER can change roles (MANAGER ↔ RECRUITER).
   * MANAGER cannot promote anyone — role management is exclusively owner-gated.
   * The OWNER's own role row is immutable.
   * Cannot assign TeamRole.OWNER to any member via this endpoint.
   */
  async updateMemberRole(
    actor: User,
    memberId: string,
    role: TeamRole,
  ): Promise<TeamMember> {
    const team = await this.getOrCreateForUser(actor);

    // Only OWNER can change roles — MANAGER is explicitly excluded
    const actorMember = await this.teamMembersRepository.findOne({
      where: { teamId: team.id, userId: actor.id, status: TeamMemberStatus.ACTIVE },
    });
    if (!actorMember || actorMember.role !== TeamRole.OWNER) {
      throw new ForbiddenException('Apenas o proprietário pode alterar funções de membros.');
    }

    // Prevent assigning the OWNER role through this endpoint
    if (role === TeamRole.OWNER) {
      throw new ForbiddenException('Não é possível atribuir a função de proprietário.');
    }

    const target = await this.teamMembersRepository.findOne({
      where: { id: memberId, teamId: team.id },
    });
    if (!target) throw new NotFoundException('Membro não encontrado.');

    if (target.role === TeamRole.OWNER) {
      throw new ForbiddenException('Não é possível alterar a função do proprietário do time.');
    }

    target.role = role;
    return this.teamMembersRepository.save(target);
  }

  /**
   * Lists pending invites addressed to the authenticated user's email,
   * with team name eagerly joined so the frontend can show context.
   */
  async listPendingInvitesForUser(user: User): Promise<TeamMember[]> {
    return this.teamMembersRepository.find({
      where: {
        invitedEmail: user.email,
        status: TeamMemberStatus.PENDING,
      },
      relations: ['team'],
      order: { joinedAt: 'DESC' },
    });
  }

  /**
   * Rejects an invite addressed to the authenticated user.
   * Removes the pending member row.
   */
  async rejectInvite(user: User, memberId: string): Promise<void> {
    const member = await this.teamMembersRepository.findOne({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Convite não encontrado.');
    if (!member.invitedEmail || member.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException('Este convite não pertence ao seu e-mail.');
    }
    if (member.status !== TeamMemberStatus.PENDING) {
      throw new ForbiddenException('Convite já foi processado.');
    }
    await this.teamMembersRepository.remove(member);
  }

  /**
   * Lists all members of the team that the user belongs to (owned or as a member).
   * Eagerly joins the user relation (selecting safe columns) so the frontend
   * can render owner names and pending email addresses in the same list.
   */
  async listMembers(user: User): Promise<TeamMember[]> {
    const team = await this.getOrCreateForUser(user);

    return this.teamMembersRepository
      .createQueryBuilder('m')
      .leftJoin('m.user', 'u')
      .addSelect(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.username', 'u.avatarUrl'])
      .where('m.teamId = :teamId', { teamId: team.id })
      .orderBy('m.joinedAt', 'ASC')
      .getMany();
  }
}
