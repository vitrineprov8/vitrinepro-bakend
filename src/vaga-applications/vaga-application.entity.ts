import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';
import { CV } from '../cv/cv.entity';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum ApplicationSource {
  NATIVE = 'NATIVE',
  GUPY_REDIRECT = 'GUPY_REDIRECT',
}

@Entity('vaga_applications')
@Unique(['vagaId', 'userId'])
export class VagaApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vaga, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga;

  @Column({ type: 'uuid' })
  vagaId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => CV, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cvId' })
  cv: CV | null;

  @Column({ type: 'uuid', nullable: true })
  cvId: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 255 })
  snapshotFullName: string;

  @Column({ type: 'varchar', length: 255 })
  snapshotEmail: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  snapshotPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  snapshotLocation: string | null;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status: ApplicationStatus;

  @Column({
    type: 'enum',
    enum: ApplicationSource,
    default: ApplicationSource.NATIVE,
  })
  source: ApplicationSource;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
