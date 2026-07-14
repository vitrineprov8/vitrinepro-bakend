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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { PayoutsService } from './payouts.service';
import { ConfigurePayoutDto } from './dto/configure-payout.dto';
import { QueryAdminPayoutsDto } from './dto/query-admin-payouts.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { ApprovePayoutDto } from './dto/approve-payout.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  // -- Hunter --------------------------------------------------------

  @Get('me/payout-config')
  getMyPayoutConfig(@Request() req: { user: { id: string } }) {
    return this.payoutsService.getPayoutConfig(req.user.id);
  }

  @Patch('me/payout-config')
  configureMyPayout(
    @Request() req: { user: { id: string } },
    @Body() dto: ConfigurePayoutDto,
  ) {
    return this.payoutsService.configurePayoutData(req.user.id, dto);
  }

  @Get('me/payouts')
  listMyPayouts(@Request() req: { user: { id: string } }) {
    return this.payoutsService.listForHunter(req.user.id);
  }

  @Post('payouts/:id/nf')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadNf(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.payoutsService.uploadNf(id, req.user.id, file);
  }

  // -- Admin -----------------------------------------------------------

  /**
   * GET /admin/payouts — visibilidade completa do pipeline (pedido explícito
   * do Andres: "o admin tem que poder ver o processo e entender que está
   * tudo certo").
   */
  @Get('admin/payouts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminList(@Query() query: QueryAdminPayoutsDto) {
    return this.payoutsService.adminList(query);
  }

  @Post('admin/payouts/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminApprove(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ApprovePayoutDto,
  ) {
    return this.payoutsService.approve(id, req.user.id, dto);
  }

  @Post('admin/payouts/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminReject(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: RejectPayoutDto,
  ) {
    return this.payoutsService.reject(id, req.user.id, dto);
  }
}
