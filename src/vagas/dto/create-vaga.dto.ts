import {
  IsBoolean,
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
import { VagaSegment, VagaStatus, VagaType, VagaWorkMode } from '../vaga.entity';

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

  /** Optional segment for filtering on the Radar. */
  @IsOptional()
  @IsEnum(VagaSegment)
  segment?: VagaSegment;

  /** Whether this vaga accepts external Hunter recruiters. */
  @IsOptional()
  @IsBoolean()
  allowHunters?: boolean;

  /** WhatsApp / phone contact revealed to matched hunters. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  hunterContactPhone?: string;

  // ── B4 — Marketplace/fee ───────────────────────────────────────────────────
  /** Fee % on the hired salary (e.g. 50 = 50%). At least one of feePercent/feeAmount required if allowHunters=true. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  feePercent?: number;

  /** Fixed fee value in R$ — alternative/complement to feePercent. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  feeAmount?: number;

  /** Max simultaneous ACCEPTED hunters on this vaga. Default 5. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  maxHunters?: number;

  /** Exclusivity window (days) locking a candidate against resubmission (RN-NOVA-02). Default 90. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  exclusivityDays?: number;
}
