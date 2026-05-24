import { IsIn } from 'class-validator';
import { HunterInterestStatus } from '../hunter-interest.entity';

const ALLOWED_STATUSES = [
  HunterInterestStatus.ACCEPTED,
  HunterInterestStatus.REJECTED,
] as const;

export class UpdateHunterInterestDto {
  @IsIn(ALLOWED_STATUSES as unknown as string[], {
    message: 'status deve ser ACCEPTED ou REJECTED',
  })
  status: HunterInterestStatus.ACCEPTED | HunterInterestStatus.REJECTED;
}
