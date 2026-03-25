import { IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';

export class AutocompleteQueryDto {
  /** Partial search term — minimum 2 characters to avoid excessive DB load */
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q: string;

  /** Restrict suggestions to a single category */
  @IsOptional()
  @IsIn(['all', 'professional', 'specialty', 'project'])
  type?: string;
}
