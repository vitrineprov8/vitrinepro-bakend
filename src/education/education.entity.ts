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

export enum EducationType {
  UNIVERSITY = 'UNIVERSITY',
  COURSE = 'COURSE',
  DIPLOMA = 'DIPLOMA',
  CERTIFICATION = 'CERTIFICATION',
}

@Entity('educations')
export class Education {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: EducationType })
  type: EducationType;

  @Column({ type: 'varchar', length: 255 })
  institution: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fieldOfStudy: string | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  certificateUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  certificateKey: string | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
