import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedFilterDto } from './create-saved-filter.dto';

export class UpdateSavedFilterDto extends PartialType(CreateSavedFilterDto) {}
