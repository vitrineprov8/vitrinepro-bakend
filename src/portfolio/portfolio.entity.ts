import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Tag } from '../tags/tag.entity';
import { PortfolioFile } from './portfolio-file.entity';

export enum PortfolioStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export enum PortfolioWorkStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

@Entity('portfolio_items')
export class PortfolioItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subtitle: string | null;

  @Column({ type: 'varchar', length: 300, unique: true })
  slug: string;

  @Column({ type: 'jsonb', default: {} })
  content: object;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientName: string | null;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duration: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  role: string | null;

  @Column({ type: 'enum', enum: PortfolioWorkStatus, nullable: true })
  projectStatus: PortfolioWorkStatus | null;

  @Column({ type: 'enum', enum: PortfolioStatus, default: PortfolioStatus.DRAFT })
  status: PortfolioStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null;

  // --- Service offering fields ---

  /** When true, this item represents a service rather than a portfolio work. */
  @Column({ type: 'boolean', default: false })
  isService: boolean;

  /** Category of service: e.g. "Agendamento", "Orçamento", "Projeto", "Venda Unitária", "Venda Pacote". */
  @Column({ type: 'varchar', length: 100, nullable: true })
  serviceType: string | null;

  /** CTA button label: e.g. "EU QUERO", "AGENDAR", "SAIBA MAIS", "CONVERSAR", "WHATSAPP", "VEJA SITE". */
  @Column({ type: 'varchar', length: 50, nullable: true })
  actionButton: string | null;

  /** Service price in BRL (e.g. 250.00). */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  servicePrice: number | null;

  /** Number of days to keep the service listing active (max 30). */
  @Column({ type: 'int', nullable: true })
  publicationDurationDays: number | null;

  /**
   * When true, this item is highlighted as "MAIS CONTRATADO" on the public profile.
   * Only one item per user may have this set to true at a time — the service layer
   * enforces the single-featured constraint by clearing all siblings on update.
   */
  @Column({ type: 'boolean', default: false, nullable: false })
  isFeatured: boolean;

  @ManyToMany(() => Tag, { cascade: true, eager: false })
  @JoinTable({ name: 'portfolio_tags' })
  tags: Tag[];

  @OneToMany(() => PortfolioFile, (file) => file.portfolioItem, { cascade: true })
  files: PortfolioFile[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
