import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PipelineStageDto {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsString()
  @MaxLength(128)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsNumber()
  @Min(0)
  order: number;

  @IsOptional()
  @IsBoolean()
  isRejected?: boolean;
}

export class UpdatePipelineTemplateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineStageDto)
  stages: PipelineStageDto[];
}
