import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ArticleStatus } from '../article.entity';

export class CreateArticleDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  content?: object;

  @IsOptional()
  @IsString()
  conclusion?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
}
