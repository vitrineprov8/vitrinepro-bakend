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

export const PLACEMENT_GUARANTEE_DAYS = 90;
export const PLACEMENT_AUTO_CONFIRM_DAYS = 7;

export const DEFAULT_PLATFORM_SHARE_PERCENT = 25;
/** @deprecated usar `DEFAULT_PLATFORM_SHARE_PERCENT` (100 - x) — mantido por compat. */
export const PLACEMENT_HUNTER_SHARE = 0.75;
/** @deprecated usar `DEFAULT_PLATFORM_SHARE_PERCENT` — mantido por compat. */
export const PLACEMENT_PLATFORM_SHARE = 0.25;

@Entity('placements')
export class Placement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'markedById' })
  markedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  markedById: string | null;

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

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  feeAmount: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  hunterShareAmount: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  platformShareAmount: number | null;

  @Column({ type: 'int', nullable: true })
  platformSharePercentApplied: number | null;

  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt: Date | null;

  @Index('IDX_placements_status')
  @Column({ type: 'varchar', length: 24, default: PlacementStatus.HIRED })
  status: PlacementStatus;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  autoConfirmed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  guaranteeEndsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  feeReleasedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disputedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  disputeReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  disputeResolvedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  departureReportedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  departureDate: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  departureReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  replacedByPlacementId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
