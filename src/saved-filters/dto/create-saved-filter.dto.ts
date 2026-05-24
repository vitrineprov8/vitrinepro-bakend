import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSavedFilterDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsObject()
  filters: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
