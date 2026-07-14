import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { PayoutStatus } from '../payout.entity';

/** Filtros de GET /admin/payouts. */
export class QueryAdminPayoutsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @IsOptional()
  @IsUUID()
  hunterId?: string;
}
