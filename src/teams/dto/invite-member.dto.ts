import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { TeamRole } from '../team-member.entity';

export class InviteMemberDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsEnum(TeamRole)
  role: TeamRole;
}
