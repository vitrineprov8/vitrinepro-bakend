import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for POST /placements/:id/departure (P4 — "Candidato saiu", dentro da garantia). */
export class ReportDepartureDto {
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}
