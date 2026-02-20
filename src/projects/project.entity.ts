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
import { ProjectImage } from './project-image.entity';

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export enum ProjectWorkStatus {
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

@Entity('projects')
export class Project {
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

  @Column({ type: 'text' })
  description: string;

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

  @Column({ type: 'enum', enum: ProjectWorkStatus, default: ProjectWorkStatus.ONGOING })
  projectStatus: ProjectWorkStatus;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DRAFT })
  status: ProjectStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null;

  @ManyToMany(() => Tag, { cascade: true, eager: false })
  @JoinTable({ name: 'project_tags' })
  tags: Tag[];

  @OneToMany(() => ProjectImage, (image) => image.project, { cascade: true })
  images: ProjectImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
