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
  PERSONAL = 'PERSONAL',
  HUNTER = 'HUNTER',
  EMPRESARIAL = 'EMPRESARIAL',
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
