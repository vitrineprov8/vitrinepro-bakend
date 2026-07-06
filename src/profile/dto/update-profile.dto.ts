import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateNested } from 'class-validator';
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerColor?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  /**
   * B4 — RN-NOVA-03: etapa (order da própria pipeline_template) a partir da
   * qual o contato de candidatos submetidos por hunter deixa de ser mascarado.
   * 0 = revela desde a 1ª coluna; default do backend é 2 (3ª coluna).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  hunterContactRevealStageOrder?: number;

  /** B5 — T-H11: chips de especialidade/segmento mostrados no perfil público. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  hunterSpecialties?: string[];

  /** B5 — T-H11: anos de experiência como recrutador. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  hunterYearsExperience?: number;
}
