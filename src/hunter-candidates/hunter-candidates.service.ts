import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { HunterCandidate, ConsentStatus } from './hunter-candidate.entity';
import {
  VagaApplication,
  ApplicationSource,
} from '../vaga-applications/vaga-application.entity';
import { Vaga, VagaStatus } from '../vagas/vaga.entity';
import { User, HunterVerificationStatus } from '../users/user.entity';
import { Placement } from '../placements/placement.entity';
import { CreateHunterCandidateDto } from './dto/create-hunter-candidate.dto';
import { UpdateHunterCandidateDto } from './dto/update-hunter-candidate.dto';
import { SubmitCandidateDto } from './dto/submit-candidate.dto';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

/**
 * B3 — Hunter talent pool + candidate submission.
 *
 * Business rules (see PLANO_DESENVOLVIMENTO.md §BACKEND / RN-NOVA):
 *  - RN-NOVA-01: a hunter may submit at most MAX_SUBMISSIONS candidates per vaga.
 *  - RN-NOVA-02: the same candidate cannot be re-submitted to the same vaga
 *    within vaga.exclusivityDays days (B4 — configurável por vaga; era uma
 *    constante fixa de 90 dias antes do B4, mantida como fallback).
 *  - Submission requires the candidate's LGPD consent (consentStatus GRANTED)
 *    and vaga.allowHunters === true.
 */
@Injectable()
export class HunterCandidatesService {
  /** RN-NOVA-01 — máximo de submissões por hunter por vaga. */
  private readonly MAX_SUBMISSIONS_PER_VAGA = 5;
  /** RN-NOVA-02 — fallback quando vaga.exclusivityDays não estiver definido. */
  private readonly DEFAULT_DUPLICATE_LOCK_DAYS = 90;

  constructor(
    @InjectRepository(HunterCandidate)
    private readonly candidatesRepo: Repository<HunterCandidate>,
    @InjectRepository(VagaApplication)
    private readonly applicationsRepo: Repository<VagaApplication>,
    @InjectRepository(Vaga)
    private readonly vagasRepo: Repository<Vaga>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Placement)
    private readonly placementsRepo: Repository<Placement>,
    private readonly mail: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── CRUD do pool ────────────────────────────────────────────────────────────

  async create(
    hunterId: string,
    dto: CreateHunterCandidateDto,
  ): Promise<HunterCandidate> {
    const email = dto.email.trim().toLowerCase();
    const dup = await this.candidatesRepo
      .createQueryBuilder('c')
      .where('c.hunterId = :hunterId', { hunterId })
      .andWhere('lower(c.email) = :email', { email })
      .getOne();
    if (dup) {
      throw new ConflictException(
        'Você já tem um candidato com este e-mail no seu pool.',
      );
    }

    // Vincula a um User real se já existir conta com este e-mail (candidato
    // "fantasma" que na verdade já é cadastrado na plataforma) — habilita
    // notificação in-app + consentimento autenticado em vez de só o token
    // por e-mail. Ver requestConsent() para o segundo ponto de vinculação
    // (caso a conta seja criada DEPOIS de o hunter cadastrar o candidato).
    const existingUser = await this.usersRepo.findOne({
      where: { email },
      select: ['id'],
    });

    const candidate = this.candidatesRepo.create({
      hunterId,
      fullName: dto.fullName,
      email,
      phone: dto.phone ?? null,
      linkedinUrl: dto.linkedinUrl ?? null,
      headline: dto.headline ?? null,
      location: dto.location ?? null,
      cvUrl: dto.cvUrl ?? null,
      notes: dto.notes ?? null,
      consentStatus: ConsentStatus.PENDING,
      linkedUserId: existingUser?.id ?? null,
    });
    return this.candidatesRepo.save(candidate);
  }

  async listMine(hunterId: string): Promise<HunterCandidate[]> {
    return this.candidatesRepo.find({
      where: { hunterId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Loads a candidate ensuring the requesting hunter owns it. */
  private async getOwned(
    id: string,
    hunterId: string,
  ): Promise<HunterCandidate> {
    const candidate = await this.candidatesRepo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('Candidato não encontrado.');
    if (candidate.hunterId !== hunterId) {
      throw new ForbiddenException('Este candidato não pertence a você.');
    }
    return candidate;
  }

  async findOne(id: string, hunterId: string): Promise<HunterCandidate> {
    return this.getOwned(id, hunterId);
  }

  async update(
    id: string,
    hunterId: string,
    dto: UpdateHunterCandidateDto,
  ): Promise<HunterCandidate> {
    const candidate = await this.getOwned(id, hunterId);
    if (dto.email && dto.email.trim().toLowerCase() !== candidate.email) {
      const email = dto.email.trim().toLowerCase();
      const dup = await this.candidatesRepo
        .createQueryBuilder('c')
        .where('c.hunterId = :hunterId', { hunterId })
        .andWhere('lower(c.email) = :email', { email })
        .andWhere('c.id != :id', { id })
        .getOne();
      if (dup) {
        throw new ConflictException(
          'Você já tem um candidato com este e-mail no seu pool.',
        );
      }
      candidate.email = email;
      // Changing the e-mail invalidates a previous consent.
      candidate.consentStatus = ConsentStatus.PENDING;
      candidate.consentToken = null;
      candidate.consentDecidedAt = null;
    }
    Object.assign(candidate, {
      fullName: dto.fullName ?? candidate.fullName,
      phone: dto.phone ?? candidate.phone,
      linkedinUrl: dto.linkedinUrl ?? candidate.linkedinUrl,
      headline: dto.headline ?? candidate.headline,
      location: dto.location ?? candidate.location,
      cvUrl: dto.cvUrl ?? candidate.cvUrl,
      notes: dto.notes ?? candidate.notes,
    });
    return this.candidatesRepo.save(candidate);
  }

  async remove(id: string, hunterId: string): Promise<void> {
    const candidate = await this.getOwned(id, hunterId);
    await this.candidatesRepo.remove(candidate);
  }

  // ── Consentimento LGPD ──────────────────────────────────────────────────────

  /**
   * Generates a consent token and "sends" it to the candidate.
   * E-mail delivery is a STUB (gap B14): the token is logged in dev.
   */
  async requestConsent(
    id: string,
    hunterId: string,
  ): Promise<{ status: ConsentStatus; consentToken?: string }> {
    const candidate = await this.getOwned(id, hunterId);
    if (candidate.consentStatus === ConsentStatus.GRANTED) {
      return { status: ConsentStatus.GRANTED };
    }

    // Re-tenta vincular a um User real: a conta pode ter sido criada DEPOIS
    // de o hunter ter cadastrado este candidato fantasma (create() só pega
    // o caso "conta já existia antes"). Sem isso, `linkedUserId` fica preso
    // em null para sempre mesmo que o candidato se cadastre a qualquer momento.
    if (!candidate.linkedUserId) {
      const existingUser = await this.usersRepo.findOne({
        where: { email: candidate.email },
        select: ['id'],
      });
      if (existingUser) candidate.linkedUserId = existingUser.id;
    }

    const token = randomBytes(24).toString('hex');
    candidate.consentToken = token;
    candidate.consentStatus = ConsentStatus.PENDING;
    candidate.consentRequestedAt = new Date();
    candidate.consentDecidedAt = null;
    await this.candidatesRepo.save(candidate);

    // B14 — envia e-mail real via Resend (ou stub-log se RESEND_API_KEY ausente).
    await this.mail.sendConsentRequest(candidate.email, candidate.fullName, token);

    // B13 — notificação in-app só faz sentido se o candidato já tiver conta
    // na plataforma (candidatos "fantasma" cadastrados só pelo hunter não têm userId).
    if (candidate.linkedUserId) {
      void this.notificationsService.create({
        userId: candidate.linkedUserId,
        type: NotificationType.CONSENT_REQUESTED,
        title: 'Solicitação de consentimento',
        message: `Um hunter solicitou seu consentimento para compartilhar seus dados (LGPD).`,
        link: `/app/candidato?consentId=${candidate.id}`,
        metadata: { candidateId: candidate.id },
      });
    }

    // Em produção NÃO retornar o token; só em dev para facilitar testes.
    const devToken =
      process.env.NODE_ENV !== 'production' ? { consentToken: token } : {};
    return { status: ConsentStatus.PENDING, ...devToken };
  }

  /** Public: candidate grants/declines consent via the emailed token. */
  async decideConsentByToken(
    token: string,
    decision: 'GRANTED' | 'DECLINED',
  ): Promise<{ status: ConsentStatus; candidateName: string }> {
    const candidate = await this.candidatesRepo.findOne({
      where: { consentToken: token },
    });
    if (!candidate) {
      throw new NotFoundException('Link de consentimento inválido ou expirado.');
    }
    candidate.consentStatus =
      decision === 'GRANTED' ? ConsentStatus.GRANTED : ConsentStatus.DECLINED;
    candidate.consentDecidedAt = new Date();
    candidate.consentToken = null; // one-time use
    await this.candidatesRepo.save(candidate);
    return {
      status: candidate.consentStatus,
      candidateName: candidate.fullName,
    };
  }

  /**
   * T-C09/N — lista as solicitações de consentimento ligadas à conta do
   * candidato logado (via `linkedUserId`), mais recentes primeiro. Inclui
   * pendentes e já decididas (histórico) — o front decide o que mostrar.
   */
  async listMyConsentRequests(userId: string): Promise<
    Array<{
      id: string;
      hunterName: string;
      fullName: string;
      email: string;
      phone: string | null;
      linkedinUrl: string | null;
      headline: string | null;
      location: string | null;
      status: ConsentStatus;
      requestedAt: Date | null;
      decidedAt: Date | null;
    }>
  > {
    const rows = await this.candidatesRepo
      .createQueryBuilder('c')
      .leftJoin('c.hunter', 'hunter')
      .addSelect(['hunter.id', 'hunter.firstName', 'hunter.lastName'])
      .where('c.linkedUserId = :userId', { userId })
      .orderBy('c.consentRequestedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC')
      .getMany();

    return rows.map((c) => ({
      id: c.id,
      hunterName: c.hunter ? `${c.hunter.firstName ?? ''} ${c.hunter.lastName ?? ''}`.trim() : 'Hunter',
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      linkedinUrl: c.linkedinUrl,
      headline: c.headline,
      location: c.location,
      status: c.consentStatus,
      requestedAt: c.consentRequestedAt,
      decidedAt: c.consentDecidedAt,
    }));
  }

  /**
   * T-C09/N — o próprio candidato (autenticado, dono via `linkedUserId`)
   * autoriza/recusa o compartilhamento dos seus dados, sem precisar do
   * token por e-mail. Mesma transição de estado do fluxo público por token.
   */
  async decideConsentAuthenticated(
    id: string,
    userId: string,
    decision: 'GRANTED' | 'DECLINED',
  ): Promise<{ status: ConsentStatus }> {
    const candidate = await this.candidatesRepo.findOne({ where: { id } });
    if (!candidate || candidate.linkedUserId !== userId) {
      throw new NotFoundException('Solicitação de consentimento não encontrada.');
    }
    if (candidate.consentStatus !== ConsentStatus.PENDING) {
      throw new BadRequestException('Esta solicitação já foi respondida.');
    }
    candidate.consentStatus =
      decision === 'GRANTED' ? ConsentStatus.GRANTED : ConsentStatus.DECLINED;
    candidate.consentDecidedAt = new Date();
    candidate.consentToken = null;
    await this.candidatesRepo.save(candidate);
    return { status: candidate.consentStatus };
  }

  // ── Submissão a uma vaga ────────────────────────────────────────────────────

  async submitToVaga(
    hunterId: string,
    vagaId: string,
    dto: SubmitCandidateDto,
  ): Promise<VagaApplication> {
    const candidate = await this.getOwned(dto.hunterCandidateId, hunterId);

    // B8 — gate do marketplace: hunter precisa estar com perfil verificado.
    const hunter = await this.usersRepo.findOne({
      where: { id: hunterId },
      select: ['id', 'verificationStatus'],
    });
    if (hunter?.verificationStatus !== HunterVerificationStatus.APPROVED) {
      throw new ForbiddenException({
        code: 'HUNTER_NOT_VERIFIED',
        message: 'Verifique seu perfil para trabalhar vagas com fee.',
      });
    }

    const vaga = await this.vagasRepo.findOne({ where: { id: vagaId } });
    if (!vaga) throw new NotFoundException('Vaga não encontrada.');
    if (vaga.status !== VagaStatus.PUBLISHED) {
      throw new BadRequestException('Esta vaga não está aberta.');
    }
    if (!vaga.allowHunters) {
      throw new ForbiddenException(
        'Esta vaga não aceita submissões de hunters.',
      );
    }
    if (vaga.deadline && vaga.deadline < new Date()) {
      throw new BadRequestException('O prazo desta vaga já encerrou.');
    }

    // Consentimento LGPD obrigatório (RN)
    if (candidate.consentStatus !== ConsentStatus.GRANTED) {
      throw new BadRequestException(
        'É necessário o consentimento do candidato (LGPD) antes de submeter.',
      );
    }

    // RN-NOVA-01 — limite de submissões por hunter nesta vaga
    const submittedCount = await this.applicationsRepo.count({
      where: { vagaId, submittedByHunterId: hunterId },
    });
    if (submittedCount >= this.MAX_SUBMISSIONS_PER_VAGA) {
      throw new ConflictException(
        `Limite de ${this.MAX_SUBMISSIONS_PER_VAGA} submissões por vaga atingido.`,
      );
    }

    // RN-NOVA-02 — trava de duplicidade (mesmo candidato/e-mail nesta vaga),
    // janela configurável por vaga (B4 — vaga.exclusivityDays), com fallback.
    const lockDays = vaga.exclusivityDays ?? this.DEFAULT_DUPLICATE_LOCK_DAYS;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lockDays);
    const recentDup = await this.applicationsRepo
      .createQueryBuilder('a')
      .where('a.vagaId = :vagaId', { vagaId })
      .andWhere('a.createdAt > :cutoff', { cutoff })
      .andWhere(
        '(a.hunterCandidateId = :cid OR lower(a.snapshotEmail) = :email)',
        { cid: candidate.id, email: candidate.email },
      )
      .getOne();
    if (recentDup) {
      throw new ConflictException(
        `Este candidato já foi submetido a esta vaga nos últimos ${lockDays} dias.`,
      );
    }

    const application = this.applicationsRepo.create({
      vagaId: vaga.id,
      userId: null,
      cvId: null,
      message: dto.message ?? null,
      snapshotFullName: candidate.fullName,
      snapshotEmail: candidate.email,
      snapshotPhone: candidate.phone,
      snapshotLocation: candidate.location,
      pipelineStage: 'para_analisar',
      isRejected: false,
      source: ApplicationSource.HUNTER,
      submittedByHunterId: hunterId,
      hunterCandidateId: candidate.id,
    });

    let saved: VagaApplication;
    try {
      saved = await this.applicationsRepo.save(application);
    } catch {
      // Colisão com o índice único parcial (vagaId, hunterCandidateId)
      throw new ConflictException(
        'Este candidato já está neste processo seletivo.',
      );
    }

    if (vaga.createdById) {
      void this.notificationsService.create({
        userId: vaga.createdById,
        type: NotificationType.CANDIDATE_SUBMITTED,
        title: 'Novo candidato submetido',
        message: `Um hunter submeteu "${candidate.fullName}" para a vaga "${vaga.title}".`,
        // /app/empresa/vagas/:id/pipeline não existe ainda — manda pro workspace real.
        link: `/app/empresa`,
        metadata: { vagaId: vaga.id, applicationId: saved.id },
      });
    }

    return saved;
  }

  /** Lists all applications submitted by this hunter (dashboard T-H08). */
  async listSubmissions(
    hunterId: string,
  ): Promise<(VagaApplication & { placement: { id: string; status: string } | null })[]> {
    const apps = await this.applicationsRepo.find({
      where: { submittedByHunterId: hunterId },
      relations: ['vaga', 'hunterCandidate'],
      order: { createdAt: 'DESC' },
    });

    // Placement (B9) — para o front saber se essa submissão virou contratação
    // e, se sim, exibir status/ações (P2 confirmar/contestar, P3 timeline).
    const appIds = apps.map((a) => a.id);
    const placements = appIds.length
      ? await this.placementsRepo.find({
          where: appIds.map((applicationId) => ({ applicationId })),
          select: ['id', 'applicationId', 'status'],
        })
      : [];
    const placementByAppId = new Map(placements.map((p) => [p.applicationId, p]));

    return apps.map((a) => {
      const placement = placementByAppId.get(a.id) ?? null;
      return Object.assign(a, {
        placement: placement ? { id: placement.id, status: placement.status } : null,
      });
    });
  }
}
