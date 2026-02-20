import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_images')
export class ProjectImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, (project) => project.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 500 })
  imageUrl: string;

  @Column({ type: 'varchar', length: 500 })
  imageKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  caption: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;
}
