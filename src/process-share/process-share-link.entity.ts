import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VagaApplication } from '../vaga-applications/vaga-application.entity';
import { User } from '../users/user.entity';

@Entity('process_share_links')
export class ProcessShareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VagaApplication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application: VagaApplication;

  @Index('IDX_process_share_links_applicationId')
  @Column({ type: 'uuid' })
  applicationId: string;

  /**
   * Random 32-byte hex token (64 chars).  Unique across all share links.
   * Used in the public URL: /processo/<token>
   */
  @Index('IDX_process_share_links_token_active', { where: '"revokedAt" IS NULL' })
  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  /** If null the link never expires. */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ type: 'uuid' })
  createdById: string;

  /** Set to the revocation timestamp to invalidate the link without deleting the row. */
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
