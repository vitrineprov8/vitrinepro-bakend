import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum PlanTier {
  FREE = 'FREE',
  RECRUITER = 'RECRUITER',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum PlanStatus {
  NONE = 'NONE',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  authProvider: 'local' | 'google' | 'linkedin' | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  oauthId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarKey: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerKey: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerColor: string | null;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profession: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  } | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  isVisible: boolean;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: PlanTier, default: PlanTier.FREE })
  plan: PlanTier;

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.NONE })
  planStatus: PlanStatus;

  @Column({ type: 'timestamp', nullable: true })
  planExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 16, unique: true, nullable: true })
  referralCode: string | null;

  // ── Company account fields ─────────────────────────────────────────────────
  /** When true this account represents a company, not an individual professional. */
  @Column({ type: 'boolean', default: false })
  isCompany: boolean;

  /** Display name of the company. Required when isCompany = true. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  /** Industry / sector of the company (free-form). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  companyIndustry: string | null;

  /** URL of the company logo stored in R2. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  companyLogoUrl: string | null;

  // ── Hunter multi-context ───────────────────────────────────────────────────
  /**
   * When set, the user is acting on behalf of this team (identified by the
   * team's id).  Null means the user is in their personal context.
   * Validated by PATCH /me/active-context — must be a team the user belongs to.
   */
  @Column({ type: 'uuid', nullable: true })
  activeContextTeamId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
