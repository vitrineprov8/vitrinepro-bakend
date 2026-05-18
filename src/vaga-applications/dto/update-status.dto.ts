import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Body for PATCH /applications/:id/status
 *
 * Replaces the old `{ status: ApplicationStatus }` DTO.
 * At least one of `pipelineStage` or `isRejected` must be present.
 */
export class UpdateStatusDto {
  /**
   * The stage id from the vaga owner's PipelineTemplate, e.g. 'entrev_rh'.
   * Free-form string — not validated against the template here; the frontend
   * sends stage ids that come from GET /me/pipeline-template.
   */
  @ValidateIf((o: UpdateStatusDto) => o.isRejected === undefined)
  @IsString()
  @MaxLength(64)
  pipelineStage?: string;

  /**
   * When true, the application is moved to the rejected bucket.
   * The frontend should also pass the id of the rejected stage in
   * `pipelineStage` for consistency, but this flag is the authoritative
   * signal for fast rejection queries.
   */
  @IsOptional()
  @IsBoolean()
  isRejected?: boolean;
}
