import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { HunterInterestsService } from './hunter-interests.service';
import { UpdateHunterInterestDto } from './dto/update-hunter-interest.dto';

@Controller()
export class HunterInterestsController {
  constructor(
    private readonly hunterInterestsService: HunterInterestsService,
  ) {}

  /**
   * Registers the authenticated user's interest as a hunter for a given vaga.
   *
   * Rules enforced in service:
   *  - Vaga must be PUBLISHED and allowHunters = true.
   *  - User cannot be the vaga creator.
   *  - 409 if already registered.
   */
  @Post('vagas/:id/hunter-interest')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  express(
    @Param('id') vagaId: string,
    @Request() req: { user: User },
  ) {
    return this.hunterInterestsService.express(vagaId, req.user);
  }

  /**
   * Lists all hunter interests for the authenticated user.
   * Shows vaga title, segment, and contact info (contact exposed only when ACCEPTED).
   */
  @Get('me/hunter-interests')
  @UseGuards(JwtAuthGuard)
  listMine(@Request() req: { user: User }) {
    return this.hunterInterestsService.listMine(req.user.id);
  }

  /**
   * Lists all hunters who expressed interest in a vaga.
   * Only the vaga creator or an admin may call this.
   * Returns hunter name, email, and phone for direct contact.
   */
  @Get('vagas/:id/hunter-interests')
  @UseGuards(JwtAuthGuard)
  listByVaga(
    @Param('id') vagaId: string,
    @Request() req: { user: User },
  ) {
    return this.hunterInterestsService.listByVaga(vagaId, req.user);
  }

  /**
   * Accepts or rejects a specific hunter's interest in a vaga.
   * Only the vaga creator or admin can call this.
   * Body: { status: 'ACCEPTED' | 'REJECTED' }
   */
  @Patch('vagas/:id/hunter-interests/:hunterId')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') vagaId: string,
    @Param('hunterId') hunterUserId: string,
    @Request() req: { user: User },
    @Body() dto: UpdateHunterInterestDto,
  ) {
    return this.hunterInterestsService.updateStatus(vagaId, hunterUserId, dto, req.user);
  }
}
