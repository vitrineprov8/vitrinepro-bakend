import { IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SocialLinksDto {
  @IsOptional() @IsString() linkedin?: string;
  @IsOptional() @IsString() github?: string;
  @IsOptional() @IsString() twitter?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() youtube?: string;
  @IsOptional() @IsString() tiktok?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  profession?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;
}
