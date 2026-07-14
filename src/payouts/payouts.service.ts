import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, PayoutStatus } from './payout.entity';
import { Placement } from '../placements/placement.entity';
import { User } from '../users/user.entity';
import { ConfigurePayoutDto } from './dto/configure-payout.dto';
import { QueryAdminPayoutsDto } from './dto/query-admin-payouts.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';
import { ApprovePayoutDto } from './dto/approve-payout.dto';
import { AsaasService } from '../payments/asaas.service';
import { StorageService } from '../storage/storage.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuditAction } from '../admin-audit-log/admin-audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { paginate, PaginatedResult } from '../common/paginate.helper';

export interface PayoutConfigResult {
  pixKey: string | null;
  pixKeyType: string | null;
  legalType: string | null;
  cpfCnpj: string | null;
  configuredAt: Date | null;
}

/**
 * B25 — pagamento da comissão do hunter. Decisão arquitetural (pedido
 * explícito do Andres, 2026-07-14, ver PLANO_DESENVOLVIMENTO.md):
 *
 *   "quiero que un admin valide, que libere, pero que el sistema sea
 *   automático — el admin tiene que poder ver el proceso y entender que
 *   está todo correcto"
 *
 * Ou seja: aprovação MANUAL (gate de segurança, `approve()`/`reject()`) +
 * execução AUTOMÁTICA pelo sistema (o admin nunca digita nada na Asaas —
 * `approve()` já chama `AsaasService.createPixTransfer()` na hora) +
 * visibilidade completa do pipeline pro admin (`adminList()` expõe todo o
 * histórico/status/motivo de cada payout).
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private asaasService: AsaasService,
    private storageService: StorageService,
    private adminAuditLogService: AdminAuditLogService,
    private notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------
  // Hunter — configuração de dados de recebimento
  // ---------------------------------------------------------------------

  async getPayoutConfig(hunterId: string): Promise<PayoutConfigResult> {
    const hunter = await this.usersRepository.findOne({ where: { id: hunterId } });
    if (!hunter) throw new NotFoundException('Usuário não encontrado.');

    return {
      pixKey: hunter.payoutPixKey,
      pixKeyType: hunter.payoutPixKeyType,
      legalType: hunter.payoutLegalType,
      cpfCnpj: hunter.payoutCpfCnpj,
      configuredAt: hunter.payoutConfiguredAt,
    };
  }

  /**
   * Salva os dados de recebimento do hunter. Também atualiza o snapshot de
   * qualquer payout ainda PENDING_REVIEW desse hunter — cobre o caso comum
   * de o fee ser liberado ANTES de o hunter configurar os dados de Pix pela
   * primeira vez (o admin só pode aprovar com o snapshot preenchido).
   */
  async configurePayoutData(
    hunterId: string,
    dto: ConfigurePayoutDto,
  ): Promise<PayoutConfigResult> {
    const hunter = await this.usersRepository.findOne({ where: { id: hunterId } });
    if (!hunter) throw new NotFoundException('Usuário não encontrado.');

    hunter.payoutPixKey = dto.pixKey;
    hunter.payoutPixKeyType = dto.pixKeyType;
    hunter.payoutLegalType = dto.legalType;
    hunter.payoutCpfCnpj = dto.cpfCnpj;
    hunter.payoutConfiguredAt = new Date();
    await this.usersRepository.save(hunter);

    await this.payoutsRepository
      .createQueryBuilder()
      .update(Payout)
      .set({
        pixKeySnapshot: dto.pixKey,
        pixKeyTypeSnapshot: dto.pixKeyType,
        legalTypeSnapshot: dto.legalType,
        cpfCnpjSnapshot: dto.cpfCnpj,
      })
      .where('hunterId = :hunterId', { hunterId })
      .andWhere('status = :status', { status: PayoutStatus.PENDING_REVIEW })
      .execute();

    return this.getPayoutConfig(hunterId);
  }

  // ---------------------------------------------------------------------
  // Criação (hook de PlacementsService quando um Placement vira FEE_RELEASED)
  // ---------------------------------------------------------------------

  /**
   * Idempotente: se já existe um payout pra este placement, devolve ele em
   * vez de duplicar (índice único em placementId também protege no banco).
   * Não cria nada se não houver hunterShareAmount (placement sem hunter).
   */
  async createForPlacement(placement: Placement, hunter: User): Promise<Payout | null> {
    if (!placement.hunterShareAmount || Number(placement.hunterShareAmount) <= 0) {
      return null;
    }

    const existing = await this.payoutsRepository.findOne({
      where: { placementId: placement.id },
    });
    if (existing) return existing;

    const payout = this.payoutsRepository.create({
      placementId: placement.id,
      hunterId: hunter.id,
      amount: placement.hunterShareAmount,
      status: PayoutStatus.PENDING_REVIEW,
      pixKeySnapshot: hunter.payoutPixKey ?? null,
      pixKeyTypeSnapshot: (hunter.payoutPixKeyType as Payout['pixKeyTypeSnapshot']) ?? null,
      legalTypeSnapshot: (hunter.payoutLegalType as Payout['legalTypeSnapshot']) ?? null,
      cpfCnpjSnapshot: hunter.payoutCpfCnpj ?? null,
    });

    return this.payoutsRepository.save(payout);
  }

  // ---------------------------------------------------------------------
  // Hunter — visualização própria + upload de NF
  // ---------------------------------------------------------------------

  async listForHunter(hunterId: string): Promise<Payout[]> {
    return this.payoutsRepository
      .createQueryBuilder('payout')
      .leftJoinAndSelect('payout.placement', 'placement')
      .leftJoinAndSelect('placement.vaga', 'vaga')
      .where('payout.hunterId = :hunterId', { hunterId })
      .orderBy('payout.createdAt', 'DESC')
      .getMany();
  }

  async uploadNf(
    payoutId: string,
    hunterId: string,
    file: Express.Multer.File,
  ): Promise<Payout> {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');

    const payout = await this.payoutsRepository.findOne({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Pagamento não encontrado.');
    if (payout.hunterId !== hunterId) {
      throw new ForbiddenException('Você não tem permissão para editar este pagamento.');
    }

    this.storageService.validatePdf(file.buffer, file.mimetype);
    const key = `payouts/nf/${payoutId}-${Date.now()}.pdf`;
    const url = await this.storageService.uploadFile(file.buffer, key, file.mimetype);

    payout.nfUrl = url;
    payout.nfKey = key;
    return this.payoutsRepository.save(payout);
  }

  // ---------------------------------------------------------------------
  // Admin — listagem/pipeline (visibilidade completa) + aprovação/rejeição
  // ---------------------------------------------------------------------

  async adminList(dto: QueryAdminPayoutsDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const qb = this.payoutsRepository
      .createQueryBuilder('payout')
      .leftJoin('payout.placement', 'placement')
      .leftJoin('placement.vaga', 'vaga')
      .leftJoin('payout.hunter', 'hunter')
      .addSelect(['placement.id', 'placement.finalSalary', 'placement.feeAmount'])
      .addSelect(['vaga.id', 'vaga.title', 'vaga.slug'])
      .addSelect(['hunter.id', 'hunter.firstName', 'hunter.lastName', 'hunter.email'])
      .orderBy('payout.createdAt', 'DESC');

    if (dto.status) qb.andWhere('payout.status = :status', { status: dto.status });
    if (dto.hunterId) qb.andWhere('payout.hunterId = :hunterId', { hunterId: dto.hunterId });

    const result = await paginate(qb, dto.page, dto.limit);
    return {
      ...result,
      data: result.data.map((p) => ({
        id: p.id,
        status: p.status,
        amount: p.amount,
        pixKeySnapshot: p.pixKeySnapshot,
        pixKeyTypeSnapshot: p.pixKeyTypeSnapshot,
        legalTypeSnapshot: p.legalTypeSnapshot,
        cpfCnpjSnapshot: p.cpfCnpjSnapshot,
        nfUrl: p.nfUrl,
        reviewedByAdminId: p.reviewedByAdminId,
        reviewedAt: p.reviewedAt,
        rejectionReason: p.rejectionReason,
        asaasTransferId: p.asaasTransferId,
        processedAt: p.processedAt,
        paidAt: p.paidAt,
        failureReason: p.failureReason,
        createdAt: p.createdAt,
        placement: p.placement
          ? { id: p.placement.id, finalSalary: p.placement.finalSalary, feeAmount: p.placement.feeAmount }
          : null,
        vaga: p.placement?.vaga ? { id: p.placement.vaga.id, title: p.placement.vaga.title, slug: p.placement.vaga.slug } : null,
        hunter: p.hunter
          ? { id: p.hunter.id, name: `${p.hunter.firstName ?? ''} ${p.hunter.lastName ?? ''}`.trim(), email: p.hunter.email }
          : null,
      })),
    };
  }

  private async loadForReview(payoutId: string): Promise<Payout> {
    const payout = await this.payoutsRepository.findOne({
      where: { id: payoutId },
      relations: ['placement', 'placement.vaga', 'hunter'],
    });
    if (!payout) throw new NotFoundException('Pagamento não encontrado.');
    return payout;
  }

  /**
   * Gate manual de segurança: um admin precisa aprovar antes de qualquer
   * dinheiro sair. Assim que aprovado, o PRÓPRIO SISTEMA executa a
   * transferência via Asaas — o admin não digita nada na Asaas manualmente.
   * Resultado (PAID/PROCESSING/FAILED) fica visível no pipeline pro admin.
   */
  async approve(payoutId: string, adminId: string, dto: ApprovePayoutDto): Promise<Payout> {
    const payout = await this.loadForReview(payoutId);

    if (payout.status !== PayoutStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Este pagamento não está aguardando revisão (status atual: ${payout.status}).`,
      );
    }
    if (!payout.pixKeySnapshot || !payout.pixKeyTypeSnapshot) {
      throw new BadRequestException(
        'O hunter ainda não configurou os dados de recebimento (chave Pix) — não é possível aprovar.',
      );
    }
    if (!this.asaasService.enabled) {
      throw new BadRequestException(
        'Gateway de pagamento não configurado (ASAAS_API_KEY ausente) — não é possível executar a transferência.',
      );
    }
    // Capturados em const antes do `await` — o TS descarta a narrowing de
    // `payout.pixKeySnapshot`/`pixKeyTypeSnapshot` (propriedades de objeto)
    // depois de qualquer `await` intermediário.
    const pixKey = payout.pixKeySnapshot;
    const pixKeyType = payout.pixKeyTypeSnapshot;

    const statusBefore = payout.status;
    payout.reviewedByAdminId = adminId;
    payout.reviewedAt = new Date();
    payout.status = PayoutStatus.PROCESSING;
    payout.processedAt = new Date();
    await this.payoutsRepository.save(payout);

    try {
      const transfer = await this.asaasService.createPixTransfer({
        value: Number(payout.amount),
        pixAddressKey: pixKey,
        pixAddressKeyType: pixKeyType,
        description: `Comissão de indicação${payout.placement?.vaga?.title ? ` — ${payout.placement.vaga.title}` : ''} — VitrinePro`,
      });

      payout.asaasTransferId = transfer.id;
      if (transfer.status === 'DONE') {
        payout.status = PayoutStatus.PAID;
        payout.paidAt = new Date();
      } else if (['CANCELLED', 'FAILED'].includes(transfer.status)) {
        payout.status = PayoutStatus.FAILED;
        payout.failureReason = transfer.failReason || `Asaas retornou status ${transfer.status}.`;
      }
      // Senão (PENDING/BANK_PROCESSING/SCHEDULED): fica PROCESSING —
      // o webhook `/webhooks/asaas/transfers` atualiza pra PAID/FAILED
      // assim que a Asaas confirmar (ver AsaasTransfersWebhookController).
    } catch (err) {
      payout.status = PayoutStatus.FAILED;
      payout.failureReason = (err as Error).message;
      this.logger.error(
        `Falha ao executar transferência do payout ${payout.id}: ${(err as Error).message}`,
      );
    }

    const saved = await this.payoutsRepository.save(payout);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.PAYOUT_APPROVE,
      targetType: 'Payout',
      targetId: saved.id,
      reason: dto.note ?? null,
      payloadBefore: { status: statusBefore },
      payloadAfter: { status: saved.status, asaasTransferId: saved.asaasTransferId },
    });

    if (saved.hunterId) {
      if (saved.status === PayoutStatus.PAID) {
        void this.notificationsService.create({
          userId: saved.hunterId,
          type: NotificationType.PAYOUT_PAID,
          title: 'Pagamento realizado!',
          message: `Sua comissão de ${this.fmtBRL(saved.amount)} foi transferida via Pix.`,
          link: '/app/hunter/ganhos',
          metadata: { payoutId: saved.id },
        });
      } else if (saved.status === PayoutStatus.FAILED) {
        void this.notificationsService.create({
          userId: saved.hunterId,
          type: NotificationType.PAYOUT_FAILED,
          title: 'Falha no pagamento',
          message: `Não foi possível transferir sua comissão de ${this.fmtBRL(saved.amount)} — verifique seus dados de recebimento.`,
          link: '/app/hunter/ganhos',
          metadata: { payoutId: saved.id },
        });
      }
    }

    return saved;
  }

  async reject(payoutId: string, adminId: string, dto: RejectPayoutDto): Promise<Payout> {
    const payout = await this.loadForReview(payoutId);

    if (payout.status !== PayoutStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        `Este pagamento não está aguardando revisão (status atual: ${payout.status}).`,
      );
    }

    const statusBefore = payout.status;
    payout.status = PayoutStatus.REJECTED;
    payout.reviewedByAdminId = adminId;
    payout.reviewedAt = new Date();
    payout.rejectionReason = dto.reason;
    const saved = await this.payoutsRepository.save(payout);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.PAYOUT_REJECT,
      targetType: 'Payout',
      targetId: saved.id,
      reason: dto.reason,
      payloadBefore: { status: statusBefore },
      payloadAfter: { status: saved.status },
    });

    if (saved.hunterId) {
      void this.notificationsService.create({
        userId: saved.hunterId,
        type: NotificationType.PAYOUT_REJECTED,
        title: 'Pagamento rejeitado',
        message: `Seu pagamento de ${this.fmtBRL(saved.amount)} foi rejeitado: ${dto.reason}`,
        link: '/app/hunter/ganhos',
        metadata: { payoutId: saved.id },
      });
    }

    return saved;
  }

  // ---------------------------------------------------------------------
  // Webhook — confirmação assíncrona da Asaas (ver AsaasTransfersWebhookController)
  // ---------------------------------------------------------------------

  async handleTransferWebhook(
    asaasTransferId: string,
    event: string,
    failReason?: string,
  ): Promise<void> {
    const payout = await this.payoutsRepository.findOne({ where: { asaasTransferId } });
    if (!payout) return;
    // Só atualiza payouts que ainda estão em processamento — evita sobrescrever
    // um estado final (PAID/FAILED) já resolvido de forma síncrona no approve().
    if (payout.status !== PayoutStatus.PROCESSING) return;

    if (event.includes('DONE')) {
      payout.status = PayoutStatus.PAID;
      payout.paidAt = new Date();
      await this.payoutsRepository.save(payout);
      if (payout.hunterId) {
        void this.notificationsService.create({
          userId: payout.hunterId,
          type: NotificationType.PAYOUT_PAID,
          title: 'Pagamento realizado!',
          message: `Sua comissão de ${this.fmtBRL(payout.amount)} foi transferida via Pix.`,
          link: '/app/hunter/ganhos',
          metadata: { payoutId: payout.id },
        });
      }
    } else if (event.includes('FAILED') || event.includes('CANCELLED')) {
      payout.status = PayoutStatus.FAILED;
      payout.failureReason = failReason || event;
      await this.payoutsRepository.save(payout);
      if (payout.hunterId) {
        void this.notificationsService.create({
          userId: payout.hunterId,
          type: NotificationType.PAYOUT_FAILED,
          title: 'Falha no pagamento',
          message: `Não foi possível transferir sua comissão de ${this.fmtBRL(payout.amount)} — verifique seus dados de recebimento.`,
          link: '/app/hunter/ganhos',
          metadata: { payoutId: payout.id },
        });
      }
    }
    // Outros eventos (PENDING/BANK_PROCESSING/SCHEDULED) — sem mudança, ainda PROCESSING.
  }

  private fmtBRL(v: number | string): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
