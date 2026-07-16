import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { InvoicesService } from './invoices.service';
import { CheckoutInvoiceDto } from './dto/checkout-invoice.dto';
import { DisputeInvoiceDto } from './dto/dispute-invoice.dto';
import { QueryAdminInvoicesDto } from './dto/query-admin-invoices.dto';
import { ResolveInvoiceDisputeDto } from './dto/resolve-invoice-dispute.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // -- Empresa -----------------------------------------------------------

  @Get('me/invoices')
  listMine(@Request() req: { user: { id: string } }) {
    return this.invoicesService.listForCompany(req.user.id);
  }

  @Post('invoices/:id/checkout')
  checkout(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: CheckoutInvoiceDto,
    @Ip() ip: string,
  ) {
    return this.invoicesService.checkout(id, req.user.id, dto, ip);
  }

  @Post('invoices/:id/dispute')
  dispute(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: DisputeInvoiceDto,
  ) {
    return this.invoicesService.dispute(id, req.user.id, dto);
  }

  // -- QA (bloqueado em produção) -------------------------------------------

  @Post('invoices/:id/qa-force-overdue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  qaForceOverdue(@Param('id') id: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Indisponível em produção.');
    }
    return this.invoicesService.qaForceOverdue(id);
  }

  // -- Admin ---------------------------------------------------------------

  @Get('admin/invoices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminList(@Query() query: QueryAdminInvoicesDto) {
    return this.invoicesService.adminList(query);
  }

  @Post('admin/invoices/:id/resolve-dispute')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminResolveDispute(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ResolveInvoiceDisputeDto,
  ) {
    return this.invoicesService.adminResolveDispute(id, req.user.id, dto);
  }
}
