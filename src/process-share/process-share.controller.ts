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

  @Post('applications/:id/share')
  @UseGuards(JwtAuthGuard)
  createShare(
    @Param('id') id: string,
    @Body() dto: CreateShareDto,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.shareService.create(id, dto, req.user.id, req.user.role);
  }

  @Get('applications/:id/share')
  @UseGuards(JwtAuthGuard)
  listShare(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.shareService.listLinks(id, req.user.id, req.user.role);
  }

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

  @Get('public/processo/:token')
  getPublicProcess(@Param('token') token: string) {
    return this.shareService.getPublicProcess(token);
  }

  @Get('applications/:id/pdf')
  @UseGuards(JwtAuthGuard)
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
    @Res() res: Response,
  ): Promise<void> {
    const app = await this.applicationsRepository.findOne({
      where: { id },
      relations: ['vaga', 'user'],
    });

    if (!app) throw new NotFoundException('Candidatura não encontrada.');

    if (
      app.vaga &&
      app.vaga.createdById !== req.user.id &&
      req.user.role !== UserRole.ADMIN
    ) {
      throw new NotFoundException('Candidatura não encontrada.');
    }

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
