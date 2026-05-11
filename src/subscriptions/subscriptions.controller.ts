import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Initiates a subscription checkout.
   * Validates the coupon if provided and returns a pending subscription with pricing breakdown.
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @Request() req: { user: { id: string } },
    @Body() dto: CheckoutDto,
  ) {
    return this.subscriptionsService.checkout(req.user.id, dto);
  }

  /**
   * Returns the authenticated user's subscription history, most recent first.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  listMine(@Request() req: { user: { id: string } }) {
    return this.subscriptionsService.listByUser(req.user.id);
  }

  /**
   * MOCK confirmation endpoint — simulates payment gateway webhook.
   * Marks subscription ACTIVE and updates user plan.
   * In production, this will be replaced by an actual payment provider webhook.
   */
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  confirm(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.subscriptionsService.confirm(id, req.user.id);
  }
}
