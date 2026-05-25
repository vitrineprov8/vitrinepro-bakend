import { IsEnum, IsString, MaxLength } from 'class-validator';
import { TombstoneType } from '../slug-tombstone.entity';

export class LookupTombstoneDto {
  @IsEnum(TombstoneType)
  type: TombstoneType;

  @IsString()
  @MaxLength(255)
  slug: string;
}
