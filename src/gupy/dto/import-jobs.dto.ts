import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class ImportJobsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  jobIds: number[];
}
