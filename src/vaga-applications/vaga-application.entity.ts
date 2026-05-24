import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';

/**
 * @deprecated ApplicationStatus enum has been replaced by the free-form
 * `pipelineStage` string + `isRejected` boolean as part of the customisable
 * pipeline migration (1747000004000).  This enum is kept here only as a
 * reference for the migration's down() reverse-mapping logic and must not be
 * used in new code.
 */
export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('vaga_applications')
@Unique(['vagaId', 'userId'])
export class VagaApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vaga, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga;

  @Column({ type: 'uuid' })
  vagaId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

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

  /**
   * Free-form stage identifier that references a stage `id` from the vaga
   * owner's PipelineTemplate.  Defaults to 'para_analisar' (the first default
   * stage).  Not a hard FK — the template is user-editable and stage ids can
   * be custom strings.
   *
   * Indexed because the kanban board filters applications by (vagaId, pipelineStage).
   */
  @Index('IDX_vaga_applications_pipelineStage')
  @Column({ type: 'varchar', length: 64, default: 'para_analisar' })
  pipelineStage: string;

  /**
   * Denormalised flag for quick rejection queries without needing to join the
   * pipeline template.  Set to true when the recruiter moves the applicant
   * into the special 'rejected' stage.
   */
  @Column({ type: 'boolean', default: false })
  isRejected: boolean;

  // ── Phase 3 enrichment fields ───────────────────────────────────────────────

  /**
   * General score given by the recruiter.  0.0–10.0 with one decimal place.
   * Stored as DECIMAL(3,1).  Null means not yet rated.
   */
  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  generalScore: number | null;

  /**
   * Free-text general note from the recruiter about this candidate.
   */
  @Column({ type: 'text', nullable: true })
  generalNote: string | null;

  /**
   * Append-only log of pipeline stage transitions.
   * Format: Array<{ stage: string; enteredAt: string; byUserId: string; note?: string }>
   * Most-recent entry is last; controller reverses on GET /history.
   */
  @Index('IDX_vaga_applications_stageHistory_gin')
  @Column({ type: 'jsonb', default: [] })
  stageHistory: Array<{
    stage: string;
    enteredAt: string;
    byUserId: string;
    note?: string;
  }>;

  /**
   * Recruiter notes/ratings keyed by stage identifier.
   * Format: Record<string, { observacoes: string; nota: number | null; updatedAt: string; byUserId: string }>
   */
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
