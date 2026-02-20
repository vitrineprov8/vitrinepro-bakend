import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { EducationType } from '../education.entity';

export class CreateEducationDto {
  @IsEnum(EducationType)
  type: EducationType;

  @IsNotEmpty()
  @IsString()
  institution: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}
