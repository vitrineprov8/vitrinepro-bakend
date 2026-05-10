import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VagaSource, VagaStatus, VagaType, VagaWorkMode } from '../vaga.entity';

export class CreateVagaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsEnum(VagaType)
  type?: VagaType;

  @IsOptional()
  @IsEnum(VagaWorkMode)
  workMode?: VagaWorkMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(VagaStatus)
  status?: VagaStatus;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsEnum(VagaSource)
  source?: VagaSource;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ValidateIf((o) => o.source === VagaSource.GUPY)
  @IsNotEmpty({ message: 'gupyConfigId é obrigatório para vagas Gupy.' })
  @IsUUID()
  gupyConfigId?: string;

  @ValidateIf((o) => o.source === VagaSource.GUPY)
  @IsNotEmpty({ message: 'externalJobId é obrigatório para vagas Gupy.' })
  @IsString()
  @MaxLength(100)
  externalJobId?: string;
}
