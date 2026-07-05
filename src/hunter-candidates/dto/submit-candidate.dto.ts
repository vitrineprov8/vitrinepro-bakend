import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Hunter submits one of their pool candidates to a vaga. */
export class SubmitCandidateDto {
  @IsUUID()
  hunterCandidateId: string;

  /** Optional message/pitch shown to the vaga owner. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
