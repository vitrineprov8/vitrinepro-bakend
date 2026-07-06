import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PortfolioStatus, PortfolioWorkStatus } from '../portfolio.entity';

export class CreatePortfolioDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  content?: object;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsEnum(PortfolioWorkStatus)
  projectStatus?: PortfolioWorkStatus;

  @IsOptional()
  @IsEnum(PortfolioStatus)
  status?: PortfolioStatus;

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  // --- Featured flag ---

  /**
   * Mark this item as the featured / "MAIS CONTRATADO" service.
   * Setting this to true via PATCH will automatically clear the flag
   * on all other portfolio items belonging to the same user.
   */
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // B16 — campos de "Service offering" removidos em 2026-07-06 (nunca teve UI,
  // zero uso real). Ver `portfolio.entity.ts` para o histórico.
}
