import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './team.entity';
import { TeamMember, TeamMemberStatus, TeamRole } from './team-member.entity';
import { User } from '../users/user.entity';

export interface TeamContext {
  /**
   * The team the user belongs to (as OWNER or ACTIVE member).
   * null when the user is not part of any team.
   */
  team: Team | null;

  /**
   * The role this user plays inside the team.
   * null when `team` is null.
   */
  role: TeamRole | null;

  /**
   * The User whose plan and quota should be charged / inspected.
   *
   *  - OWNER  → the owner themselves (quotaOwner === user)
   *  - MANAGER/RECRUITER (ACTIVE) → the team owner
   *  - No team → the user themselves
   */
  quotaOwner: User;
}

/**
 * TeamContextHelper
 *
 * Centralised resolution of team membership context.
 * Injected by PlansService, VagasService, and CompaniesService so that the
 * "is this user a team member, and if so whose plan do they inherit?" logic
 * lives in exactly one place.
 *
 * Performance notes
 * -----------------
 * - Two targeted point-reads (findOne with indexed columns) — no table scans.
 * - `team.owner` is eagerly joined in a single query to avoid an N+1 when
 *   callers need `quotaOwner`.
 * - Results are NOT cached at the request level here; callers that need to
 *   call this multiple times within a single request should cache the result
 *   themselves.
 */
@Injectable()
export class TeamContextHelper {
  constructor(
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMembersRepository: Repository<TeamMember>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Resolves the full team context for the given user.
   *
   * Algorithm:
   *  1. Check if the user OWNS a team → role = OWNER, quotaOwner = user.
   *  2. Check if the user is an ACTIVE member of any team → role = their role,
   *     quotaOwner = the team owner's User record.
   *  3. Neither → team = null, role = null, quotaOwner = user.
   */
  async getTeamContext(user: User): Promise<TeamContext> {
    // 1. Is this user the OWNER of a team?
    const ownedTeam = await this.teamsRepository.findOne({
      where: { ownerId: user.id },
    });
    if (ownedTeam) {
      return { team: ownedTeam, role: TeamRole.OWNER, quotaOwner: user };
    }

    // 2. Is this user an ACTIVE member of someone else's team?
    const membership = await this.teamMembersRepository
      .createQueryBuilder('tm')
      .innerJoinAndSelect('tm.team', 'team')
      .innerJoinAndSelect('team.owner', 'owner')
      .where('tm.userId = :userId', { userId: user.id })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      // Exclude the OWNER row (safety: OWNER should never appear here since
      // OWNER rows have the same userId as the team's ownerId, caught above).
      .andWhere('tm.role != :ownerRole', { ownerRole: TeamRole.OWNER })
      .getOne();

    if (membership?.team) {
      return {
        team: membership.team,
        role: membership.role,
        quotaOwner: membership.team.owner,
      };
    }

    // 3. No team context — solo user.
    return { team: null, role: null, quotaOwner: user };
  }

  /**
   * Returns true if `user` is either the OWNER of `team` or an ACTIVE MANAGER
   * in that team.
   *
   * Used by TeamsService to gate invite/remove/setRecruiters actions.
   */
  async isOwnerOrManager(team: Team, user: User): Promise<boolean> {
    if (team.ownerId === user.id) return true;

    const member = await this.teamMembersRepository.findOne({
      where: {
        teamId: team.id,
        userId: user.id,
        status: TeamMemberStatus.ACTIVE,
        role: TeamRole.MANAGER,
      },
    });

    return member !== null;
  }

  /**
   * Returns all userIds that belong to the team the given `ownerId` owns,
   * including the owner and all ACTIVE members (any role).
   *
   * Used by VagasService to build team-wide vaga lists.
   */
  async getTeamUserIds(ownerId: string): Promise<string[]> {
    const team = await this.teamsRepository.findOne({
      where: { ownerId },
    });
    if (!team) return [ownerId];

    const members = await this.teamMembersRepository.find({
      where: { teamId: team.id, status: TeamMemberStatus.ACTIVE },
      select: ['userId'],
    });

    const ids = members
      .map((m) => m.userId)
      .filter((id): id is string => id !== null);

    // Always include the owner even if somehow not in team_members
    if (!ids.includes(ownerId)) ids.push(ownerId);

    return ids;
  }
}
