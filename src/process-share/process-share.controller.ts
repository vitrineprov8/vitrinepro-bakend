import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { ProcessShareService } from './process-share.service';
import { PdfService } from './pdf.service';
import { CreateShareDto } from './dto/create-share.dto';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Controller()
export class ProcessShareController {
  constructor(
    private readonly shareService: ProcessShareService,
    private readonly pdfService: PdfService,
    @InjectRepository(VagaApplication)
    private readonly applicationsRepository: Repository<VagaApplication>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * POST /applications/:id/share
   * Generates a new share link for the given application.
   * Only the vaga owner or admin may call this.
   */
  @Post('applications/:id/share')
  @UseGuards(JwtAuthGuard)
  createShare(
    @Param('id') id: string,
    @Body() dto: CreateShareDto,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.shareService.create(id, dto, req.user.id, req.user.role);
  }

  /**
   * DELETE /applications/:id/share/:token
   * Revokes the share link (sets revokedAt = now).
   */
  @Delete('applications/:id/share/:token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeShare(
    @Param('id') id: string,
    @Param('token') token: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.shareService.revoke(id, token, req.user.id, req.user.role);
  }

  /**
   * GET /public/processo/:token
   * Public (no auth) endpoint.  Returns a sanitised snapshot of the process.
   */
  @Get('public/processo/:token')
  getPublicProcess(@Param('token') token: string) {
    return this.shareService.getPublicProcess(token);
  }

  /**
   * GET /applications/:id/pdf
   * Generates and streams a PDF for the application.
   * Requires auth and vaga ownership.
   */
  @Get('applications/:id/pdf')
  @UseGuards(JwtAuthGuard)
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Res() res: Response,
  ): Promise<void> {
    // Load application with all needed relations for PDF generation
    const app = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['vaga', 'user'],
    });

    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    // Authorization: vaga owner or admin
    if (
      app.vaga &&
      app.vaga.createdById !== req.user.id &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new NotFoundException('Candidatura não encontrada.');
    }

    // Build author map for stageHistory
    const userIds = [...new Set(app.stageHistory.map((e) => e.byUserId))];
    const authors = userIds.length
      ? await this.usersRepository.find({
          where: userIds.map((uid) => ({ id: uid })),
          select: ['id', 'firstName', 'lastName'],
        })
      : [];
    const authorMap = new Map(
      authors.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    // Get active share link for footer URL
    const activeLink = await this.shareService.getActiveLink(id);

    const pdfBuffer = await this.pdfService.generateApplicationPdf(
      app as any,
      authorMap,
      activeLink,
    );

    const safeDate = new Date().toISOString().slice(0, 10);
    const safeName = app.snapshotFullName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="processo-${safeName}-${safeDate}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }
}
