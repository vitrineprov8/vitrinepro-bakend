import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { ProjectStatus, ProjectWorkStatus } from '../project.entity';

export class ListProjectsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(ProjectWorkStatus)
  projectStatus?: ProjectWorkStatus;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
