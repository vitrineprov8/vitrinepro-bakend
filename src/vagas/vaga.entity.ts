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
import { Company } from '../companies/company.entity';

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

export enum VagaSegment {
  COMERCIO_VENDAS = 'COMERCIO_VENDAS',
  LOGISTICA_TRANSPORTE = 'LOGISTICA_TRANSPORTE',
  FINANCAS_CONTABILIDADE = 'FINANCAS_CONTABILIDADE',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  TECNOLOGIA = 'TECNOLOGIA',
  RH = 'RH',
  SAUDE = 'SAUDE',
  EDUCACAO = 'EDUCACAO',
  MARKETING = 'MARKETING',
  JURIDICO = 'JURIDICO',
  OUTROS = 'OUTROS',
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

  /**
   * Timestamp of the first publication of this vaga.
   * Set by the publish endpoint; never reset even if the vaga is closed/re-published.
   */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  /**
   * Optional segment / area of activity for this vaga.
   * Allows filtering on the public Radar endpoint.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  segment: VagaSegment | null;

  /**
   * When true, the vaga accepts interest from external Hunter recruiters.
   * The hunter contact phone is shown to matched hunters.
   */
  @Column({ type: 'boolean', default: false })
  allowHunters: boolean;

  /** WhatsApp / phone contact shown to hunters when allowHunters = true. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  hunterContactPhone: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  /**
   * Optional client company associated with this vaga.
   * Only available when the recruiter is on a TEAM or ENTERPRISE plan.
   * SET NULL on company deletion so the vaga is preserved.
   */
  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'companyId' })
  company: Company | null;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  /**
   * Team member responsible for managing this vaga.
   * Only valid when the recruiter is on a TEAM or ENTERPRISE plan.
   * SET NULL on user deletion so the vaga is preserved.
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User | null;

  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
