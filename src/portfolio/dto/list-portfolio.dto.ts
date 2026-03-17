import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { PortfolioStatus } from '../portfolio.entity';

export class ListPortfolioDto extends PaginationDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(PortfolioStatus)
  status?: PortfolioStatus;
}
