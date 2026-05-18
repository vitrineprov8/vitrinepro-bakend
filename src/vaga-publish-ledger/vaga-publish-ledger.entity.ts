import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';

/**
 * VagaPublishLedger — append-only log of publish events per billing cycle.
 *
 * Every time a vaga is published (DRAFT → PUBLISHED) for the first time in a
 * given billing cycle, one row is inserted here.  This record is NEVER deleted,
 * even if the vaga is later closed or removed (the FK to Vaga is SET NULL).
 * This makes the slot consumption irreversible within the cycle, closing the
 * delete-and-recreate abuse loop.
 *
 * Unique index on (userId, vagaId, cycleStart) prevents double-counting the
 * same vaga in the same cycle (e.g. publish → close → re-publish).
 */
@Entity('vaga_publish_ledger')
@Index('UQ_ledger_user_vaga_cycle', ['userId', 'vagaId', 'cycleStart'], {
  unique: true,
  where: '"vagaId" IS NOT NULL',
})
export class VagaPublishLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user who published the vaga — CASCADE so orphan rows are cleaned on user deletion */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  /**
   * The vaga that was published.  SET NULL when the vaga is deleted so that
   * the ledger row (and the consumed slot) is preserved.
   */
  @ManyToOne(() => Vaga, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga | null;

  @Column({ type: 'uuid', nullable: true })
  vagaId: string | null;

  /** Start of the billing cycle in which this publish was counted */
  @Column({ type: 'timestamptz' })
  cycleStart: Date;

  /** End of the billing cycle in which this publish was counted */
  @Column({ type: 'timestamptz' })
  cycleEnd: Date;

  /** Timestamp when the publish action was recorded */
  @CreateDateColumn({ type: 'timestamptz' })
  publishedAt: Date;
}
