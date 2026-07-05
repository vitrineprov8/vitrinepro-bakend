import { PartialType } from '@nestjs/mapped-types';
import { CreateHunterCandidateDto } from './create-hunter-candidate.dto';

export class UpdateHunterCandidateDto extends PartialType(
  CreateHunterCandidateDto,
) {}
