import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGupyConfigDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  displayName: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain deve conter apenas letras minúsculas, números e hífens.',
  })
  subdomain: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
