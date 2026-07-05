import {
  Body,
  Controller,
  Delete,
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
import { HunterCandidatesService } from './hunter-candidates.service';
import { CreateHunterCandidateDto } from './dto/create-hunter-candidate.dto';
import { UpdateHunterCandidateDto } from './dto/update-hunter-candidate.dto';
import { SubmitCandidateDto } from './dto/submit-candidate.dto';
import { DecideConsentDto } from './dto/decide-consent.dto';

type Req = { user: { id: string } };

@Controller()
export class HunterCandidatesController {
  constructor(private readonly service: HunterCandidatesService) {}

  // ── Pool CRUD ───────────────────────────────────────────────────────────────

  @Post('hunter-candidates')
  @UseGuards(JwtAuthGuard)
  create(@Request() req: Req, @Body() dto: CreateHunterCandidateDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get('hunter-candidates')
  @UseGuards(JwtAuthGuard)
  listMine(@Request() req: Req) {
    return this.service.listMine(req.user.id);
  }

  /** Dashboard T-H08: todas as submissões feitas por este hunter. */
  @Get('hunter-candidates/submissions')
  @UseGuards(JwtAuthGuard)
  listSubmissions(@Request() req: Req) {
    return this.service.listSubmissions(req.user.id);
  }

  @Get('hunter-candidates/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@Request() req: Req, @Param('id') id: string) {
    return this.service.findOne(id, req.user.id);
  }

  @Patch('hunter-candidates/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req: Req,
    @Param('id') id: string,
    @Body() dto: UpdateHunterCandidateDto,
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Delete('hunter-candidates/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: Req, @Param('id') id: string) {
    return this.service.remove(id, req.user.id);
  }

  // ── Consentimento LGPD ──────────────────────────────────────────────────────

  /** Gera token e "envia" e-mail de consentimento (stub B14). */
  @Post('hunter-candidates/:id/request-consent')
  @UseGuards(JwtAuthGuard)
  requestConsent(@Request() req: Req, @Param('id') id: string) {
    return this.service.requestConsent(id, req.user.id);
  }

  /** Público: o candidato concede/recusa consentimento pelo token do e-mail. */
  @Post('public/candidate-consent/:token')
  @HttpCode(HttpStatus.OK)
  decideConsent(
    @Param('token') token: string,
    @Body() dto: DecideConsentDto,
  ) {
    return this.service.decideConsentByToken(token, dto.decision);
  }

  // ── Submissão a uma vaga ────────────────────────────────────────────────────

  @Post('vagas/:id/submissions')
  @UseGuards(JwtAuthGuard)
  submit(
    @Request() req: Req,
    @Param('id') vagaId: string,
    @Body() dto: SubmitCandidateDto,
  ) {
    return this.service.submitToVaga(req.user.id, vagaId, dto);
  }
}
