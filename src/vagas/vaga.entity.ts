import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { GupyConfig } from '../gupy/gupy-config.entity';

export enum VagaStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
}

export enum VagaType {
  CLT = 'CLT',
  PJ = 'PJ',
  FREELA = 'FREELA',
  ESTAGIO = 'ESTAGIO',
}

export enum VagaWorkMode {
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  ONSITE = 'ONSITE',
}

export enum VagaSource {
  NATIVE = 'NATIVE',
  GUPY = 'GUPY',
}

@Entity('vagas')
export class Vaga {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 300, unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string | null;

  @Column({ type: 'text', nullable: true })
  benefits: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'enum', enum: VagaType, nullable: true })
  type: VagaType | null;

  @Column({ type: 'enum', enum: VagaWorkMode, nullable: true })
  workMode: VagaWorkMode | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMin: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMax: number | null;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date | null;

  @Column({ type: 'enum', enum: VagaStatus, default: VagaStatus.DRAFT })
  status: VagaStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ type: 'enum', enum: VagaSource, default: VagaSource.NATIVE })
  source: VagaSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @ManyToOne(() => GupyConfig, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'gupyConfigId' })
  gupyConfig: GupyConfig | null;

  @Column({ type: 'uuid', nullable: true })
  gupyConfigId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalJobId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
