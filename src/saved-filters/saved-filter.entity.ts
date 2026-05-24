import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('saved_filters')
export class SavedFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_saved_filters_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Human-readable label chosen by the user. */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Arbitrary JSON blob containing the filter parameters
   * (q, segment, city, type, workMode, salaryMin, etc.).
   * Stored as JSONB for efficient querying and future indexing.
   */
  @Column({ type: 'jsonb' })
  filters: Record<string, unknown>;

  /**
   * When true this filter is loaded automatically on Radar open.
   * Only one filter per user can be default — enforced by the service.
   */
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  /**
   * Display order within the Preferências grid (0-based, lower = first).
   * Managed by the client; ties broken by createdAt.
   */
  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;
}
