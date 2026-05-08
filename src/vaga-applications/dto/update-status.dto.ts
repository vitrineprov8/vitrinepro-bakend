import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../vaga-application.entity';

export class UpdateStatusDto {
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;
}
