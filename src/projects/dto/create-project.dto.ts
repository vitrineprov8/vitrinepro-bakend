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
import { ProjectStatus, ProjectWorkStatus } from '../project.entity';

export class CreateProjectDto {
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
  @IsEnum(ProjectWorkStatus)
  projectStatus?: ProjectWorkStatus;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  externalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
