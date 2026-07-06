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

export enum UserPersona {
  CANDIDATO = 'CANDIDATO',
  HUNTER = 'HUNTER',
  EMPRESA = 'EMPRESA',
}

export enum HunterVerificationStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface VerificationDocument {
  url: string;
  label: string;
  uploadedAt: string;
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

  @Column({ type: 'simple-array', nullable: true })
  personas: UserPersona[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  passwordResetExpiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  emailVerificationExpiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isCompany: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyIndustry: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  companyLogoUrl: string | null;

  // ── B22 — split de placement negociável por empresa ─────────────────────────
  @Column({ type: 'int', nullable: true })
  placementPlatformSharePercent: number | null;

  @Column({ type: 'jsonb', default: [] })
  placementSplitHistory: Array<{
    changedAt: string;
    changedByAdminId: string;
    previousPercent: number | null;
    newPercent: number;
    reason: string;
  }>;

  @Column({ type: 'uuid', nullable: true })
  activeContextTeamId: string | null;

  @Column({ type: 'int', default: 2 })
  hunterContactRevealStageOrder: number;

  @Column({ type: 'simple-array', nullable: true })
  hunterSpecialties: string[] | null;

  @Column({ type: 'int', nullable: true })
  hunterYearsExperience: number | null;

  @Column({ type: 'varchar', length: 16, default: HunterVerificationStatus.NONE })
  verificationStatus: HunterVerificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  verificationDocs: VerificationDocument[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  verificationLinkedinUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verificationRequestedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  verificationDecidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  verificationRejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
