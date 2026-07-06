import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './team.entity';
import { TeamMember, TeamMemberStatus, TeamRole } from './team-member.entity';
import { User } from '../users/user.entity';

export interface TeamContext {
  team: Team | null;
  role: TeamRole | null;
  quotaOwner: User;
}

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

  async getTeamContext(user: User): Promise<TeamContext> {
    if (!user.activeContextTeamId) {
      return { team: null, role: null, quotaOwner: user };
    }

    const targetTeamId = user.activeContextTeamId;

    const ownedTeam = await this.teamsRepository.findOne({
      where: { id: targetTeamId, ownerId: user.id },
    });
    if (ownedTeam) {
      return { team: ownedTeam, role: TeamRole.OWNER, quotaOwner: user };
    }

    const membership = await this.teamMembersRepository
      .createQueryBuilder('tm')
      .innerJoinAndSelect('tm.team', 'team')
      .innerJoinAndSelect('team.owner', 'owner')
      .where('tm.userId = :userId', { userId: user.id })
      .andWhere('tm.teamId = :teamId', { teamId: targetTeamId })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .andWhere('tm.role != :ownerRole', { ownerRole: TeamRole.OWNER })
      .getOne();

    if (membership?.team) {
      return {
        team: membership.team,
        role: membership.role,
        quotaOwner: membership.team.owner,
      };
    }

    return { team: null, role: null, quotaOwner: user };
  }

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

  async getTeamForUser(userId: string): Promise<Team | null> {
    const ownedTeam = await this.teamsRepository.findOne({
      where: { ownerId: userId },
    });
    if (ownedTeam) return ownedTeam;

    const membership = await this.teamMembersRepository
      .createQueryBuilder('tm')
      .innerJoinAndSelect('tm.team', 'team')
      .where('tm.userId = :userId', { userId })
      .andWhere('tm.status = :status', { status: TeamMemberStatus.ACTIVE })
      .getOne();

    return membership?.team ?? null;
  }

  async canManageAsTeamLead(
    vagaCreatorId: string,
    actorId: string,
  ): Promise<boolean> {
    if (!vagaCreatorId || vagaCreatorId === actorId) return false;

    const team = await this.getTeamForUser(vagaCreatorId);
    if (!team) return false;

    if (team.ownerId === actorId) return true;

    const managerMembership = await this.teamMembersRepository.findOne({
      where: {
        teamId: team.id,
        userId: actorId,
        status: TeamMemberStatus.ACTIVE,
        role: TeamRole.MANAGER,
      },
    });

    return managerMembership !== null;
  }

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

    if (!ids.includes(ownerId)) ids.push(ownerId);

    return ids;
  }
}
