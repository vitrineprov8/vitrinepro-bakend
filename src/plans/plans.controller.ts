import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlansService } from './plans.service';

@Controller()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /** Public endpoint — returns all available plans with pricing and features */
  @Get('plans')
  listPlans() {
    return this.plansService.listPlans();
  }

  /** Returns the authenticated user's current plan info and vaga usage */
  @Get('me/plan')
  @UseGuards(JwtAuthGuard)
  getMyPlan(@Request() req: { user: { id: string } }) {
    return this.plansService.getMyPlan(req.user.id);
  }
}
