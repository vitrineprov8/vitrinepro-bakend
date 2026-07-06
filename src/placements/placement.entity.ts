import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';

/**
 * B9 — Placement. Spec: `design-spec/06_ADMIN_E_FLUXOS_TRANSVERSAIS.md §P`.
 *
 * Fluxo: HIRED (P1, empresa marca) → CONFIRMED (P2, hunter confirma ou
 * auto-confirm em 7d) → [DISPUTED se o hunter contestar] → dentro da janela
 * de garantia (90d a partir de `confirmedAt`) a empresa pode reportar saída
 * do candidato (`GUARANTEE_BROKEN`) e o hunter indica substituto, o que gera
 * um novo Placement linkado (`REPLACED`). Se a garantia expira sem quebra,
 * o fee é liberado (`FEE_RELEASED`).
 *
 * Só existe fee/hunterShare/platformShare/garantia quando `hunterId` não é
 * nulo (candidato veio de indicação de hunter — `ApplicationSource.HUNTER`).
 * Contratações diretas (sem hunter) ainda geram um Placement (registro/
 * auditoria + insumo para B12), mas já nascem `CONFIRMED` sem fee/garantia.
 */
export enum PlacementStatus {
  HIRED = 'HIRED',
  CONFIRMED = 'CONFIRMED',
  DISPUTED = 'DISPUTED',
  GUARANTEE_BROKEN = 'GUARANTEE_BROKEN',
  REPLACED = 'REPLACED',
  FEE_RELEASED = 'FEE_RELEASED',
  CANCELLED = 'CANCELLED',
}

export enum PlacementRegime {
  CLT = 'CLT',
  PJ = 'PJ',
}

/** Duração fixa da garantia, em dias, conforme a spec (§P1/P3: "garantia de 90 dias"). */
export const PLACEMENT_GUARANTEE_DAYS = 90;

/** Janela para confirmação bilateral do hunter antes do auto-confirm (§P2: "7 dias"). */
export const PLACEMENT_AUTO_CONFIRM_DAYS = 7;

/** Split do fee confirmado na spec: hunter 75% / plataforma 25% (§P1, exemplo R$3.500 → R$2.625/R$875). */
export const PLACEMENT_HUNTER_SHARE = 0.75;
export const PLACEMENT_PLATFORM_SHARE = 0.25;

@Entity('placements')
export class Placement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Uma candidatura só pode virar um placement (índice único abaixo). */
  @ManyToOne(() => VagaApplication, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'applicationId' })
  application: VagaApplication;

  @Index('IDX_placements_applicationId', { unique: true })
  @Column({ type: 'uuid' })
  applicationId: string;

  @ManyToOne(() => Vaga, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga | null;

  @Column({ type: 'uuid', nullable: true })
  vagaId: string | null;

  /** Quem marcou como contratado (dono da vaga ou delegado de time — B15). */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'markedById' })
  markedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  markedById: string | null;

  /** Hunter da indicação, quando `application.source === HUNTER`. Null em contratação direta. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hunterId' })
  hunter: User | null;

  @Index('IDX_placements_hunterId')
  @Column({ type: 'uuid', nullable: true })
  hunterId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  finalSalary: number;

  @Column({ type: 'varchar', length: 8, nullable: true })
  regime: PlacementRegime | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  // ── Fee (só quando hunterId != null) ─────────────────────────────────────
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  feeAmount: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  hunterShareAmount: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  platformShareAmount: number | null;

  /** Checkbox "Li e aceito os termos do placement" (§P1, obrigatório quando há hunter). */
  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt: Date | null;

  @Index('IDX_placements_status')
  @Column({ type: 'varchar', length: 24, default: PlacementStatus.HIRED })
  status: PlacementStatus;

  // ── P2 — confirmação bilateral ───────────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  autoConfirmed: boolean;

  /** confirmedAt + 90 dias — fim da janela de garantia. */
  @Column({ type: 'timestamp', nullable: true })
  guaranteeEndsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  feeReleasedAt: Date | null;

  // ── Disputa (hunter contesta em P2) ──────────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  disputedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  disputeReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  disputeResolvedAt: Date | null;

  // ── P4 — quebra de garantia / reposição ──────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  departureReportedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  departureDate: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  departureReason: string | null;

  /**
   * Reposição — escopo confirmado com Andres: só reposição gratuita (o
   * hunter indica um novo candidato sem custo), sem fluxo de estorno
   * proporcional por ora (a spec cita as duas opções, mas o estorno fica
   * fora do MVP). Aponta para o novo Placement gerado quando a reposição é
   * efetivamente contratada.
   */
  @Column({ type: 'uuid', nullable: true })
  replacedByPlacementId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
