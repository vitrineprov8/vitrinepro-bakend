import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsInt,
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

  @IsNotEmpty()
  @IsString()
  description: string;

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
}
