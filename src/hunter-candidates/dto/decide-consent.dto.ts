import { IsIn } from 'class-validator';

/** Public endpoint body: the candidate grants or declines LGPD consent. */
export class DecideConsentDto {
  @IsIn(['GRANTED', 'DECLINED'])
  decision: 'GRANTED' | 'DECLINED';
}
