import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { TeamsService } from './teams.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateTeamProfileDto } from './dto/update-team-profile.dto';

@Controller('me/team')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * Returns the team for the authenticated user.
   * Creates one if the user is on a TEAM/ENTERPRISE plan and none exists yet.
   * Throws 403 with code PLAN_TIER_REQUIRED for FREE/RECRUITER plans.
   */
  @Get()
  getMyTeam(@Request() req: { user: User }) {
    return this.teamsService.getOrCreateForUser(req.user);
  }

  /**
   * T-T01/T-T08 — Updates the consultoria's public profile.
   * Only the team OWNER may call this.
   */
  @Patch()
  updateProfile(
    @Request() req: { user: User },
    @Body() dto: UpdateTeamProfileDto,
  ) {
    return this.teamsService.updateProfile(req.user, dto);
  }

  /** Returns the member list for the user's team */
  @Get('members')
  listMembers(@Request() req: { user: User }) {
    return this.teamsService.listMembers(req.user);
  }

  /**
   * Lists ALL teams the user can act in: owned team + active memberships.
   * Used by the context switcher when a recruiter has multiple team invites.
   */
  @Get('accessible')
  listAccessible(@Request() req: { user: User }) {
    return this.teamsService.listAccessibleTeams(req.user);
  }

  /**
   * Invites a new member by email.
   * Only OWNER or MANAGER can invite.
   * Respects the plan's seat limit.
   */
  @Post('invite')
  invite(@Request() req: { user: User }, @Body() dto: InviteMemberDto) {
    return this.teamsService.invite(req.user, dto);
  }

  /**
   * Accepts an invite on behalf of the authenticated user.
   * Matches on memberId and the user's email address.
   */
  @Post('accept/:memberId')
  acceptInvite(
    @Request() req: { user: User },
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.acceptInvite(req.user, memberId);
  }

  /** Lists pending invites addressed to the authenticated user's email. */
  @Get('invites/pending')
  listPendingInvites(@Request() req: { user: User }) {
    return this.teamsService.listPendingInvitesForUser(req.user);
  }

  /** Rejects (deletes) a pending invite addressed to the authenticated user. */
  @Post('invites/:memberId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  rejectInvite(
    @Request() req: { user: User },
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.rejectInvite(req.user, memberId);
  }

  /** Removes a member from the team. Only the OWNER can do this. */
  @Delete('members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Request() req: { user: User },
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.removeMember(req.user, memberId);
  }

  /** Updates a member's role. Only the OWNER can do this. */
  @Patch('members/:memberId')
  updateMemberRole(
    @Request() req: { user: User },
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(req.user, memberId, dto.role);
  }
}
