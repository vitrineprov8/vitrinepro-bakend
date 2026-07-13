import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { CouponsService } from './coupons.service';
import { CreateCouponCampaignDto } from './dto/create-coupon-campaign.dto';
import { UpdateCouponCampaignDto } from './dto/update-coupon-campaign.dto';

@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /** Returns the authenticated user's referral coupon, creating it on demand */
  @Get('me/coupon')
  @UseGuards(JwtAuthGuard)
  getMyCoupon(@Request() req: { user: { id: string } }) {
    return this.couponsService.getOrCreateForUser(req.user.id);
  }

  /** Conta/Indicações (M4) — lista as redenções do próprio cupom do usuário. */
  @Get('me/coupon/redemptions')
  @UseGuards(JwtAuthGuard)
  getMyRedemptions(@Request() req: { user: { id: string } }) {
    return this.couponsService.listMyRedemptions(req.user.id);
  }

  /**
   * Public endpoint — no authentication required.
   * Returns active promotional coupons (ownerId IS NULL) so the frontend can
   * display campaign banners (e.g. "Use FREE50 for 50% off").
   * Only code, discountType and discountValue are exposed.
   */
  @Get('coupons/public/active')
  listPublicActive() {
    return this.couponsService.listPublicActive();
  }

  /**
   * Publicly validates a coupon code.
   * Uses OptionalJwtAuthGuard to detect self-use (user using their own referral code).
   */
  @Get('coupons/:code/validate')
  @UseGuards(OptionalJwtAuthGuard)
  validateCode(
    @Param('code') code: string,
    @Request() req: { user?: { id: string } },
  ) {
    return this.couponsService.validate(code, req.user?.id);
  }

  /** Admin: lists all pending redemptions awaiting validation */
  @Get('admin/coupons/redemptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listPendingRedemptions() {
    return this.couponsService.listPendingRedemptions();
  }

  /** Admin: validates a redemption and grants +30 days bonus to coupon owner */
  @Post('admin/coupons/redemptions/:id/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  validateRedemption(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.couponsService.validateRedemption(id, req.user.id);
  }

  /** Admin: rejects a redemption */
  @Post('admin/coupons/redemptions/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  rejectRedemption(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.couponsService.rejectRedemption(id, req.user.id);
  }

  // A5 — Cupons de campanha (CRUD admin, tab 2 de /app/admin/cupons).

  @Get('admin/coupons/campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  listCampaigns(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.couponsService.listCampaigns(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('admin/coupons/campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createCampaign(
    @Body() dto: CreateCouponCampaignDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.couponsService.createCampaign(dto, req.user.id);
  }

  @Patch('admin/coupons/campaigns/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateCouponCampaignDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.couponsService.updateCampaign(id, dto, req.user.id);
  }

  @Post('admin/coupons/campaigns/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  toggleCampaign(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.couponsService.toggleCampaign(id, req.user.id);
  }
}
