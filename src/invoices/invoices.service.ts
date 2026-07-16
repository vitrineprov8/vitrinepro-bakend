import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Invoice, InvoiceStatus, InvoiceType } from './invoice.entity';
import { Placement } from '../placements/placement.entity';
import { User } from '../users/user.entity';
import { CheckoutInvoiceDto, InvoiceBillingType } from './dto/checkout-invoice.dto';
import { DisputeInvoiceDto } from './dto/dispute-invoice.dto';
import { QueryAdminInvoicesDto } from './dto/query-admin-invoices.dto';
import {
  ResolveInvoiceDisputeDto,
  InvoiceDisputeResolution,
} from './dto/resolve-invoice-dispute.dto';
import { AsaasService } from '../payments/asaas.service';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { AdminAuditAction } from '../admin-audit-log/admin-audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { paginate, PaginatedResult } from '../common/paginate.helper';

export interface InvoiceCheckoutResult {
  invoiceId: string;
  amount: number;
  billingType: InvoiceBillingType;
  status: InvoiceStatus;
  invoiceUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpirationDate?: string;
}

/** Fatura vencida há mais desses dias bloqueia novas publicações (T-E07). */
export const INVOICE_DELINQUENCY_BLOCK_DAYS = 7;
/** Prazo de vencimento padrão a partir da criação da fatura. */
const INVOICE_DUE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Faturas de fee" — spec `05_WORKSPACE_EMPRESA.md §T-E07`. Fecha o gap do
 * B11 em que o fee de um placement vindo de hunter nunca era de fato cobrado
 * da empresa (só calculado e, via B25, pago ao hunter). Segue o mesmo padrão
 * de checkout Asaas já usado em `SubscriptionsService` (customer → payment →
 * QR/confirm síncrono → webhook ativa PIX/BOLETO depois).
 *
 * Não importa `PlacementsModule`/`VagasModule` (evita ciclo) — são eles que
 * importam `InvoicesModule` e chamam os métodos daqui.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private asaasService: AsaasService,
    private adminAuditLogService: AdminAuditLogService,
    private notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------
  // Criação (hook de PlacementsService quando um Placement vira HIRED)
  // ---------------------------------------------------------------------

  /**
   * Idempotente (índice único em placementId protege no banco também). Não
   * cria nada se o placement não tiver fee (ex.: candidatura direta).
   */
  async createForPlacement(placement: Placement, companyId: string): Promise<Invoice | null> {
    if (!placement.feeAmount || Number(placement.feeAmount) <= 0) {
      return null;
    }

    const existing = await this.invoicesRepository.findOne({
      where: { placementId: placement.id },
    });
    if (existing) return existing;

    const dueDate = new Date(Date.now() + INVOICE_DUE_DAYS * DAY_MS);

    const invoice = this.invoicesRepository.create({
      companyId,
      placementId: placement.id,
      type: InvoiceType.FEE,
      amount: placement.feeAmount,
      dueDate,
      status: InvoiceStatus.PENDING,
    });
    const saved = await this.invoicesRepository.save(invoice);

    void this.notificationsService.create({
      userId: companyId,
      type: NotificationType.INVOICE_CREATED,
      title: 'Nova fatura de fee',
      message: `Uma fatura de ${this.fmtBRL(saved.amount)} foi gerada pela contratação via hunter. Vencimento em ${INVOICE_DUE_DAYS} dias.`,
      link: '/app/empresa/faturas',
      metadata: { invoiceId: saved.id },
    });

    return saved;
  }

  // ---------------------------------------------------------------------
  // Empresa — visualização própria + checkout + contestação
  // ---------------------------------------------------------------------

  async listForCompany(companyId: string): Promise<Invoice[]> {
    return this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.placement', 'placement')
      .leftJoinAndSelect('placement.vaga', 'vaga')
      .where('invoice.companyId = :companyId', { companyId })
      .orderBy('invoice.createdAt', 'DESC')
      .getMany();
  }

  private async loadForCompany(invoiceId: string, companyId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id: invoiceId },
      relations: ['placement', 'placement.vaga'],
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    if (invoice.companyId !== companyId) {
      throw new ForbiddenException('Você não tem permissão para acessar esta fatura.');
    }
    return invoice;
  }

  async checkout(
    invoiceId: string,
    companyId: string,
    dto: CheckoutInvoiceDto,
    remoteIp?: string,
  ): Promise<InvoiceCheckoutResult> {
    const invoice = await this.loadForCompany(invoiceId, companyId);

    if (![InvoiceStatus.PENDING, InvoiceStatus.OVERDUE].includes(invoice.status)) {
      throw new BadRequestException(
        `Esta fatura não pode ser paga (status atual: ${invoice.status}).`,
      );
    }
    if (!this.asaasService.enabled) {
      throw new BadRequestException(
        'Gateway de pagamento não configurado (ASAAS_API_KEY ausente).',
      );
    }

    const company = await this.usersRepository.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Usuário não encontrado.');

    company.cpfCnpj = dto.cpfCnpj;
    company.billingPostalCode = dto.postalCode;
    company.billingAddressNumber = dto.addressNumber;
    await this.usersRepository.save(company);

    const customerId = await this.asaasService.getOrCreateCustomer(company.asaasCustomerId, {
      name: `${company.firstName} ${company.lastName}`,
      email: company.email,
      cpfCnpj: dto.cpfCnpj,
      phone: company.phone,
      postalCode: dto.postalCode,
      addressNumber: dto.addressNumber,
      externalReference: company.id,
    });
    if (!company.asaasCustomerId) {
      company.asaasCustomerId = customerId;
      await this.usersRepository.save(company);
    }

    const dueDateStr = new Date().toISOString().slice(0, 10);
    const vagaTitle = invoice.placement?.vaga?.title;

    const payment = await this.asaasService.createPayment({
      customer: customerId,
      billingType: dto.billingType,
      value: Number(invoice.amount),
      dueDate: dueDateStr,
      description: `VitrinePro - Fee de contratação${vagaTitle ? ` — ${vagaTitle}` : ''}`,
      externalReference: invoice.id,
      remoteIp,
      ...(dto.billingType === InvoiceBillingType.CREDIT_CARD && dto.creditCard
        ? {
            creditCard: dto.creditCard,
            creditCardHolderInfo: {
              name: `${company.firstName} ${company.lastName}`,
              email: company.email,
              cpfCnpj: dto.cpfCnpj,
              postalCode: dto.postalCode,
              addressNumber: dto.addressNumber,
              phone: company.phone || undefined,
            },
          }
        : {}),
    });

    invoice.asaasPaymentId = payment.id;
    invoice.invoiceUrl = payment.invoiceUrl || payment.bankSlipUrl || null;
    invoice.billingType = dto.billingType;
    await this.invoicesRepository.save(invoice);

    const result: InvoiceCheckoutResult = {
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
      billingType: dto.billingType,
      status: invoice.status,
      invoiceUrl: invoice.invoiceUrl ?? undefined,
    };

    if (dto.billingType === InvoiceBillingType.PIX) {
      try {
        const qr = await this.asaasService.getPixQrCode(payment.id);
        result.pixQrCode = qr.encodedImage;
        result.pixCopyPaste = qr.payload;
        result.pixExpirationDate = qr.expirationDate;
      } catch (err) {
        this.logger.warn(`Falha ao buscar QR code Pix: ${(err as Error).message}`);
      }
    }

    if (
      dto.billingType === InvoiceBillingType.CREDIT_CARD &&
      ['CONFIRMED', 'RECEIVED'].includes(payment.status)
    ) {
      await this.markPaid(invoice);
      result.status = InvoiceStatus.PAID;
    } else if (dto.billingType === InvoiceBillingType.CREDIT_CARD) {
      throw new BadRequestException(
        'Pagamento recusado pelo cartão. Verifique os dados ou tente outro método.',
      );
    }

    return result;
  }

  /** Chamado pelo webhook da Asaas (fan-out do mesmo endpoint usado por SubscriptionsService). */
  async activateFromAsaasPaymentId(asaasPaymentId: string): Promise<void> {
    const invoice = await this.invoicesRepository.findOne({ where: { asaasPaymentId } });
    if (!invoice) return;
    if (![InvoiceStatus.PENDING, InvoiceStatus.OVERDUE].includes(invoice.status)) {
      return; // já processada - idempotente (Asaas pode reenviar o mesmo evento)
    }
    await this.markPaid(invoice);
  }

  private async markPaid(invoice: Invoice): Promise<Invoice> {
    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    return this.invoicesRepository.save(invoice);
  }

  async dispute(invoiceId: string, companyId: string, dto: DisputeInvoiceDto): Promise<Invoice> {
    const invoice = await this.loadForCompany(invoiceId, companyId);

    if (![InvoiceStatus.PENDING, InvoiceStatus.OVERDUE].includes(invoice.status)) {
      throw new BadRequestException(
        `Esta fatura não pode ser contestada (status atual: ${invoice.status}).`,
      );
    }

    invoice.status = InvoiceStatus.DISPUTED;
    invoice.disputeReason = dto.reason;
    invoice.disputedAt = new Date();
    return this.invoicesRepository.save(invoice);
  }

  // ---------------------------------------------------------------------
  // Admin — listagem + resolução de disputa
  // ---------------------------------------------------------------------

  async adminList(dto: QueryAdminInvoicesDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const qb = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.company', 'company')
      .leftJoin('invoice.placement', 'placement')
      .leftJoin('placement.vaga', 'vaga')
      .addSelect(['company.id', 'company.firstName', 'company.lastName', 'company.email'])
      .addSelect(['placement.id', 'placement.finalSalary', 'placement.feeAmount'])
      .addSelect(['vaga.id', 'vaga.title', 'vaga.slug'])
      .orderBy('invoice.createdAt', 'DESC');

    if (dto.status) qb.andWhere('invoice.status = :status', { status: dto.status });
    if (dto.companyId) qb.andWhere('invoice.companyId = :companyId', { companyId: dto.companyId });

    const result = await paginate(qb, dto.page, dto.limit);
    return {
      ...result,
      data: result.data.map((i) => ({
        id: i.id,
        type: i.type,
        status: i.status,
        amount: i.amount,
        dueDate: i.dueDate,
        billingType: i.billingType,
        invoiceUrl: i.invoiceUrl,
        paidAt: i.paidAt,
        disputeReason: i.disputeReason,
        disputedAt: i.disputedAt,
        disputeResolvedAt: i.disputeResolvedAt,
        createdAt: i.createdAt,
        company: i.company
          ? {
              id: i.company.id,
              name: `${i.company.firstName ?? ''} ${i.company.lastName ?? ''}`.trim(),
              email: i.company.email,
            }
          : null,
        placement: i.placement
          ? { id: i.placement.id, finalSalary: i.placement.finalSalary, feeAmount: i.placement.feeAmount }
          : null,
        vaga: i.placement?.vaga
          ? { id: i.placement.vaga.id, title: i.placement.vaga.title, slug: i.placement.vaga.slug }
          : null,
      })),
    };
  }

  async adminResolveDispute(
    invoiceId: string,
    adminId: string,
    dto: ResolveInvoiceDisputeDto,
  ): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');
    if (invoice.status !== InvoiceStatus.DISPUTED) {
      throw new BadRequestException('Esta fatura não está em disputa.');
    }

    const statusBefore = invoice.status;

    if (dto.resolution === InvoiceDisputeResolution.MARK_PAID) {
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
    } else {
      // REOPEN — volta a cobrar: PENDING se ainda no prazo, senão OVERDUE de novo.
      invoice.status = invoice.dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.PENDING;
    }
    invoice.disputeResolvedAt = new Date();
    const saved = await this.invoicesRepository.save(invoice);

    void this.adminAuditLogService.record({
      adminId,
      action: AdminAuditAction.INVOICE_RESOLVE_DISPUTE,
      targetType: 'Invoice',
      targetId: saved.id,
      reason: dto.note ?? null,
      payloadBefore: { status: statusBefore },
      payloadAfter: { status: saved.status },
    });

    if (saved.companyId) {
      void this.notificationsService.create({
        userId: saved.companyId,
        type: saved.status === InvoiceStatus.PAID ? NotificationType.INVOICE_CREATED : NotificationType.INVOICE_OVERDUE,
        title: saved.status === InvoiceStatus.PAID ? 'Disputa resolvida — fatura paga' : 'Disputa resolvida — fatura reaberta',
        message:
          saved.status === InvoiceStatus.PAID
            ? `Sua contestação foi aceita e a fatura de ${this.fmtBRL(saved.amount)} foi marcada como paga.`
            : `Sua contestação foi recusada — a fatura de ${this.fmtBRL(saved.amount)} voltou a ficar em aberto.`,
        link: '/app/empresa/faturas',
        metadata: { invoiceId: saved.id },
      });
    }

    return saved;
  }

  // ---------------------------------------------------------------------
  // Bloqueio de publish por inadimplência (T-E07) + sweep de vencimento
  // ---------------------------------------------------------------------

  /** `VagasService.publish()` chama isso pro dono da vaga (quota owner). */
  async hasBlockingDelinquency(companyId: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - INVOICE_DELINQUENCY_BLOCK_DAYS * DAY_MS);
    const overdue = await this.invoicesRepository.findOne({
      where: { companyId, status: InvoiceStatus.OVERDUE },
    });
    if (!overdue) return false;
    return overdue.dueDate < cutoff;
  }

  /** Roda 1x/dia: PENDING com dueDate vencido vira OVERDUE + notifica a empresa. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweepOverdue(): Promise<void> {
    const now = new Date();
    const pending = await this.invoicesRepository.find({
      where: { status: InvoiceStatus.PENDING },
    });
    for (const invoice of pending) {
      if (invoice.dueDate >= now) continue;
      invoice.status = InvoiceStatus.OVERDUE;
      await this.invoicesRepository.save(invoice);
      void this.notificationsService.create({
        userId: invoice.companyId,
        type: NotificationType.INVOICE_OVERDUE,
        title: 'Fatura vencida',
        message: `A fatura de ${this.fmtBRL(invoice.amount)} venceu. Pague em até ${INVOICE_DELINQUENCY_BLOCK_DAYS} dias para evitar o bloqueio de novas publicações.`,
        link: '/app/empresa/faturas',
        metadata: { invoiceId: invoice.id },
      });
    }
  }

  /**
   * QA-only (bloqueado em produção, mesmo padrão de
   * `PlacementsService.qaForceAdvance`): força uma fatura pra OVERDUE há mais
   * de `INVOICE_DELINQUENCY_BLOCK_DAYS` dias, pra validar o bloqueio de
   * publish sem esperar o vencimento real ou o cron rodar.
   */
  async qaForceOverdue(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada.');

    invoice.dueDate = new Date(Date.now() - (INVOICE_DELINQUENCY_BLOCK_DAYS + 1) * DAY_MS);
    invoice.status = InvoiceStatus.OVERDUE;
    return this.invoicesRepository.save(invoice);
  }

  private fmtBRL(v: number | string): string {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
