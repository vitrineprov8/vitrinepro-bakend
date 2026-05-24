import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateShareDto {
  /** Number of days until the link expires.  Default: 30.  Max: 365.  0 = never expires. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  expiresInDays?: number;
}
