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
import { CV } from '../cv/cv.entity';
import { HunterCandidate } from '../hunter-candidates/hunter-candidate.entity';

/**
 * @deprecated ApplicationStatus enum has been replaced by the free-form
 * `pipelineStage` string + `isRejected` boolean as part of the customisable
 * pipeline migration (1747000004000).
 */
export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

/** How the application entered the pipeline. */
export enum ApplicationSource {
  DIRECT = 'DIRECT',
  HUNTER = 'HUNTER',
}

/**
 * NOTE: uniqueness enforced by PARTIAL unique indexes in migration
 * 1748600000000 because `userId` is now nullable for ghost candidates.
 */
@Entity('vaga_applications')
export class VagaApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vaga, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga;

  @Column({ type: 'uuid' })
  vagaId: string;

  /** Null for hunter-submitted ghost candidates (see hunterCandidateId). */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 16, default: ApplicationSource.DIRECT })
  source: ApplicationSource;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'submittedByHunterId' })
  submittedByHunter: User | null;

  @Index('IDX_vaga_applications_submittedByHunterId')
  @Column({ type: 'uuid', nullable: true })
  submittedByHunterId: string | null;

  @ManyToOne(() => HunterCandidate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hunterCandidateId' })
  hunterCandidate: HunterCandidate | null;

  @Column({ type: 'uuid', nullable: true })
  hunterCandidateId: string | null;

  @ManyToOne(() => CV, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cvId' })
  cv: CV | null;

  @Column({ type: 'uuid', nullable: true })
  cvId: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 255 })
  snapshotFullName: string;

  @Column({ type: 'varchar', length: 255 })
  snapshotEmail: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  snapshotPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  snapshotLocation: string | null;

  @Index('IDX_vaga_applications_pipelineStage')
  @Column({ type: 'varchar', length: 64, default: 'para_analisar' })
  pipelineStage: string;

  @Column({ type: 'boolean', default: false })
  isRejected: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  generalScore: number | null;

  @Column({ type: 'text', nullable: true })
  generalNote: string | null;

  @Index('IDX_vaga_applications_stageHistory_gin')
  @Column({ type: 'jsonb', default: [] })
  stageHistory: Array<{
    stage: string;
    enteredAt: string;
    byUserId: string;
    note?: string;
  }>;

  @Column({ type: 'jsonb', default: {} })
  stageNotes: Record<
    string,
    {
      observacoes: string;
      nota: number | null;
      updatedAt: string;
      byUserId: string;
    }
  >;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
