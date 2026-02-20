import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { ArticleStatus } from '../article.entity';

export class ListArticlesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
}
