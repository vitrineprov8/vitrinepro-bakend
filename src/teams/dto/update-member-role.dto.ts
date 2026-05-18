import { IsEnum } from 'class-validator';
import { TeamRole } from '../team-member.entity';

export class UpdateMemberRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}
