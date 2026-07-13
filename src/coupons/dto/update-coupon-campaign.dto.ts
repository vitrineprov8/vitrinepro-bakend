import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponCampaignDto } from './create-coupon-campaign.dto';

/** Body para PATCH /admin/coupons/campaigns/:id (A5). Código incluso pode
 * ser trocado (raro, mas o spec não proíbe) — unicidade validada no service. */
export class UpdateCouponCampaignDto extends PartialType(CreateCouponCampaignDto) {}
