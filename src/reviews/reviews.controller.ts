import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('placements/:id/review')
  create(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(id, req.user.id, req.user.role, dto);
  }

  @Get('placements/:id/review')
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.reviewsService.findByPlacement(id, req.user.id, req.user.role);
  }

  @Get('me/placements/pending-review')
  listPending(@Request() req: { user: { id: string } }) {
    return this.reviewsService.listPendingForCompany(req.user.id);
  }
}
