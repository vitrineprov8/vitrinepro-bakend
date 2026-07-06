import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HunterVerificationStatus,
  User,
  UserPersona,
  VerificationDocument,
} from '../users/user.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { StorageService } from '../storage/storage.service';
import { MailService } from '../mail/mail.service';
import { HuntersQueryDto } from './dto/hunters-query.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';

/** B5 — campos públicos de um card do diretório `GET /hunters` (T07). */
export interface HunterDirectoryCard {
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  profession: string | null;
  location: string | null;
  hunterSpecialties: string[] | null;
  hunterYearsExperience: number | null;
  isVerified: boolean;
  metrics: HunterMetrics;
}

/** B5 — métricas agregadas mostradas no diretório e no perfil público (T07/T08). */
export interface HunterMetrics {
  totalIndicacoes: number;
  /**
   * % de indicações que saíram da etapa inicial ("para_analisar") ao menos
   * uma vez, dentre as já submetidas. Proxy de "taxa de aproveitamento" —
   * o conceito de "contratação confirmada" só existirá com B9 (placements).
   */
  taxaAproveitamento: number | null;
  /** Dias médios entre a submissão e a 1ª mudança de etapa (proxy de "tempo até shortlist"). */
  tempoMedioAteAbordagemDias: number | null;
  /** Média de `generalScore` (0-10) das indicações avaliadas por recrutadores. Proxy até B10 (avaliações). */
  avaliacaoMedia: number | null;
}

const PUBLIC_USER_FIELDS = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  profession: true,
  bio: true,
  location: true,
  socialLinks: true,
  hunterSpecialties: true,
  hunterYearsExperience: true,
  verificationStatus: true,
  // Precisa vir junto para o check `user.personas?.includes(HUNTER)` em
  // getPublicProfile funcionar — sem isso o campo vem undefined e o perfil
  // de qualquer hunter real dá 404.
  personas: true,
} as const;

@Injectable()
export class HuntersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(VagaApplication)
    private vagaApplicationsRepository: Repository<VagaApplication>,
    private storageService: StorageService,
    private mailService: MailService,
  ) {}

  /** T07 — diretório público de hunters, com filtros e paginação. */
  async listDirectory(
    query: HuntersQueryDto,
  ): Promise<{ items: HunterDirectoryCard[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const verifiedOnly = query.verifiedOnly !== false; // default true, conforme spec

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where('user.isVisible = :visible', { visible: true })
      .andWhere('user.isCompany = false')
      // personas é `simple-array` (texto separado por vírgula) — LIKE é seguro aqui
      // pois 'HUNTER' não é substring de 'CANDIDATO'/'EMPRESA'.
      .andWhere("user.personas LIKE :hunter", { hunter: '%HUNTER%' });

    if (verifiedOnly) {
      qb.andWhere('user.verificationStatus = :approved', {
        approved: HunterVerificationStatus.APPROVED,
      });
    }
    if (query.specialty) {
      qb.andWhere('user.hunterSpecialties ILIKE :specialty', {
        specialty: `%${query.specialty}%`,
      });
    }
    if (query.city) {
      qb.andWhere('user.location ILIKE :city', { city: `%${query.city}%` });
    }

    // 'placements'/'rating' ainda não têm dado próprio (B9/B10 pendentes) — caem
    // para o mesmo critério de 'recent' até essas métricas existirem de verdade.
    qb.orderBy('user.updatedAt', 'DESC');

    const total = await qb.getCount();
    const users = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = await Promise.all(
      users.map(async (u) => ({
        username: u.username!,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUrl: u.avatarUrl,
        profession: u.profession,
        location: u.location,
        hunterSpecialties: u.hunterSpecialties,
        hunterYearsExperience: u.hunterYearsExperience,
        isVerified: u.verificationStatus === HunterVerificationStatus.APPROVED,
        metrics: await this.getMetrics(u.id),
      })),
    );

    return { items, total, page, limit };
  }

  /** T08 — perfil público de um hunter pelo slug `/hunter/[username]`. */
  async getPublicProfile(username: string) {
    const user = await this.usersRepository.findOne({
      where: { username, isVisible: true, isCompany: false },
      select: PUBLIC_USER_FIELDS,
    });
    if (!user || !user.personas?.includes(UserPersona.HUNTER)) {
      throw new NotFoundException('Perfil de hunter não encontrado.');
    }

    const metrics = await this.getMetrics(user.id);
    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      profession: user.profession,
      bio: user.bio,
      location: user.location,
      socialLinks: user.socialLinks,
      hunterSpecialties: user.hunterSpecialties,
      hunterYearsExperience: user.hunterYearsExperience,
      isVerified: user.verificationStatus === HunterVerificationStatus.APPROVED,
      metrics,
    };
  }

  /** Métricas derivadas de `VagaApplication` — ver notas de cada campo em `HunterMetrics`. */
  async getMetrics(hunterId: string): Promise<HunterMetrics> {
    const applications = await this.vagaApplicationsRepository.find({
      where: { submittedByHunterId: hunterId },
      select: [
        'id',
        'createdAt',
        'pipelineStage',
        'generalScore',
        'stageHistory',
      ],
    });

    const totalIndicacoes = applications.length;
    if (totalIndicacoes === 0) {
      return {
        totalIndicacoes: 0,
        taxaAproveitamento: null,
        tempoMedioAteAbordagemDias: null,
        avaliacaoMedia: null,
      };
    }

    const advanced = applications.filter(
      (a) => a.pipelineStage !== 'para_analisar' || a.stageHistory.length > 1,
    );
    const taxaAproveitamento = Math.round(
      (advanced.length / totalIndicacoes) * 100,
    );

    const shortlistDays: number[] = [];
    for (const app of applications) {
      const firstMove = app.stageHistory.find(
        (h) => h.stage !== 'para_analisar',
      );
      if (firstMove) {
        const days =
          (new Date(firstMove.enteredAt).getTime() -
            new Date(app.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (days >= 0) shortlistDays.push(days);
      }
    }
    const tempoMedioAteAbordagemDias =
      shortlistDays.length > 0
        ? Math.round(
            (shortlistDays.reduce((sum, d) => sum + d, 0) /
              shortlistDays.length) *
              10,
          ) / 10
        : null;

    const scored = applications.filter((a) => a.generalScore !== null);
    const avaliacaoMedia =
      scored.length > 0
        ? Math.round(
            (scored.reduce((sum, a) => sum + Number(a.generalScore), 0) /
              scored.length) *
              10,
          ) / 10
        : null;

    return {
      totalIndicacoes,
      taxaAproveitamento,
      tempoMedioAteAbordagemDias,
      avaliacaoMedia,
    };
  }

  // ── B8 — Verificação de hunter ──────────────────────────────────────────────

  /** `POST /profile/me/verification/documents` — anexa um doc (RG, comprovante...) ao pedido em construção. */
  async uploadVerificationDocument(
    userId: string,
    label: string,
    file: Express.Multer.File,
  ): Promise<{ verificationDocs: VerificationDocument[] }> {
    if (!label?.trim()) {
      throw new BadRequestException('Informe um rótulo para o documento.');
    }
    this.storageService.validatePdf(file.buffer, file.mimetype);

    const user = await this.findUserOrFail(userId);
    if (user.verificationStatus === HunterVerificationStatus.APPROVED) {
      throw new BadRequestException('Seu perfil já está verificado.');
    }

    const timestamp = Date.now();
    const key = `verification-docs/${userId}/${timestamp}_${label.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    const url = await this.storageService.uploadFile(
      file.buffer,
      key,
      'application/pdf',
    );

    const docs = user.verificationDocs ?? [];
    docs.push({ url, label, uploadedAt: new Date().toISOString() });
    user.verificationDocs = docs;
    await this.usersRepository.save(user);

    return { verificationDocs: docs };
  }

  /** `POST /profile/me/verification/submit` — envia os docs já anexados para a fila do admin. */
  async submitVerification(
    userId: string,
    dto: SubmitVerificationDto,
  ): Promise<{ verificationStatus: HunterVerificationStatus }> {
    const user = await this.findUserOrFail(userId);

    if (user.verificationStatus === HunterVerificationStatus.APPROVED) {
      throw new BadRequestException('Seu perfil já está verificado.');
    }
    if (!user.verificationDocs || user.verificationDocs.length === 0) {
      throw new BadRequestException(
        'Envie ao menos um documento antes de solicitar a verificação.',
      );
    }

    user.verificationStatus = HunterVerificationStatus.PENDING;
    user.verificationRequestedAt = new Date();
    user.verificationDecidedAt = null;
    user.verificationRejectionReason = null;
    if (dto.linkedinUrl) user.verificationLinkedinUrl = dto.linkedinUrl;

    await this.usersRepository.save(user);
    return { verificationStatus: user.verificationStatus };
  }

  /** Admin — `GET /admin/hunters/verifications`: fila de pedidos pendentes. */
  async adminListVerifications(): Promise<Partial<User>[]> {
    return this.usersRepository.find({
      where: { verificationStatus: HunterVerificationStatus.PENDING },
      order: { verificationRequestedAt: 'ASC' },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        verificationDocs: true,
        verificationLinkedinUrl: true,
        verificationRequestedAt: true,
      },
    });
  }

  /** Admin — aprova o pedido: ativa o selo "Verificado" e libera o marketplace. */
  async adminApprove(userId: string): Promise<{ verificationStatus: HunterVerificationStatus }> {
    const user = await this.findUserOrFail(userId);
    if (user.verificationStatus !== HunterVerificationStatus.PENDING) {
      throw new BadRequestException('Este pedido não está pendente de análise.');
    }

    user.verificationStatus = HunterVerificationStatus.APPROVED;
    user.verificationDecidedAt = new Date();
    user.verificationRejectionReason = null;
    await this.usersRepository.save(user);

    void this.mailService.sendVerificationApproved(user.email, user.firstName);
    return { verificationStatus: user.verificationStatus };
  }

  /** Admin — recusa o pedido, com motivo mostrado ao hunter. */
  async adminReject(
    userId: string,
    dto: RejectVerificationDto,
  ): Promise<{ verificationStatus: HunterVerificationStatus }> {
    const user = await this.findUserOrFail(userId);
    if (user.verificationStatus !== HunterVerificationStatus.PENDING) {
      throw new BadRequestException('Este pedido não está pendente de análise.');
    }

    user.verificationStatus = HunterVerificationStatus.REJECTED;
    user.verificationDecidedAt = new Date();
    user.verificationRejectionReason = dto.reason;
    await this.usersRepository.save(user);

    void this.mailService.sendVerificationRejected(
      user.email,
      user.firstName,
      dto.reason,
    );
    return { verificationStatus: user.verificationStatus };
  }

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }
}
