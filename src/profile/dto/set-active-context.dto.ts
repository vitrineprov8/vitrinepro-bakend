import { IsOptional, IsUUID } from 'class-validator';

export class SetActiveContextDto {
  /**
   * The teamId to activate, or null to switch back to personal context.
   */
  @IsOptional()
  @IsUUID()
  teamId: string | null;
}
