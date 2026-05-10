import { PartialType } from '@nestjs/mapped-types';
import { CreateGupyConfigDto } from './create-gupy-config.dto';

export class UpdateGupyConfigDto extends PartialType(CreateGupyConfigDto) {}
