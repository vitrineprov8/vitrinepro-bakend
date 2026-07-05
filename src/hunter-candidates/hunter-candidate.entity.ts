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

/** LGPD consent lifecycle of a hunter's candidate. */
export enum ConsentStatus {
  PENDING = 'PENDING',
  GRANTED = 'GRANTED',
  DECLINED = 'DECLINED',
}

/**
 * B3 — Private talent pool of a hunter ("candidato fantasma").
 *
 * A hunter builds a CRM of candidates that may not have a VitrinePro account.
 * Before submitting a candidate to a vaga the hunter must obtain LGPD consent
 * via an e-mailed token (consentStatus === GRANTED). E-mail delivery is still
 * a stub (gap B14).
 *
 * Unique per (hunterId, lower(email)) — enforced by a DB index.
 */
@Entity('hunter_candidates')
export class HunterCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner hunter. */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hunterId' })
  hunter: User;

  @Index('IDX_hunter_candidates_hunterId')
  @Column({ type: 'uuid' })
  hunterId: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  linkedinUrl: string | null;

  /** Short professional headline / current role. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  headline: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  /** Optional CV uploaded by the hunter (S3). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  cvUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cvKey: string | null;

  /** Private notes visible only to the owner hunter. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** If the ghost candidate is later matched to a real VitrinePro user. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'linkedUserId' })
  linkedUser: User | null;

  @Column({ type: 'uuid', nullable: true })
  linkedUserId: string | null;

  @Column({ type: 'varchar', length: 16, default: ConsentStatus.PENDING })
  consentStatus: ConsentStatus;

  /** One-time token sent to the candidate's e-mail to grant/decline consent. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  consentToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  consentRequestedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  consentDecidedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
