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
} from 'class-validator';
import { Type } from 'class-transformer';
import { VagaStatus, VagaType, VagaWorkMode } from '../vaga.entity';

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

  /**
   * Optional UUID of a Company owned by the user.
   * Only honoured for TEAM/ENTERPRISE plans — validation happens in the service.
   */
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
