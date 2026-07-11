import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReviewTag } from '../hunter-review.entity';

/** Body for POST /placements/:id/review (B10 — RN-NOVA-07). Imutável após criada. */
export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsEnum(ReviewTag, { each: true })
  tags?: ReviewTag[];
}
