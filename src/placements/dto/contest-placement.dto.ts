import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for POST /placements/:id/contest (P2 — hunter contesta os dados). */
export class ContestPlacementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
