import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { PlacementRegime } from '../placement.entity';

/**
 * Body for POST /applications/:id/placement (P1 — "Marcar contratado").
 *
 * `termsAccepted` é obrigatório (deve ser `true`) apenas quando a candidatura
 * veio de indicação de hunter — validado no service, não aqui, pois depende
 * de `application.source`.
 */
export class MarkHiredDto {
  @IsNumber()
  @IsPositive()
  finalSalary: number;

  @IsOptional()
  @IsEnum(PlacementRegime)
  regime?: PlacementRegime;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

  /**
   * Presente quando este placement é a reposição gratuita (P4) de um
   * placement anterior com garantia quebrada (`GUARANTEE_BROKEN`).
   */
  @IsOptional()
  @IsUUID()
  replacesPlacementId?: string;
}
