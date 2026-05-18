import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PipelineStage } from './pipeline-stage.embedded';

@Entity('pipeline_templates')
export class PipelineTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The recruiter who owns this template.
   * Cascades on user deletion so no orphan rows remain.
   */
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  /**
   * Explicit FK column — indexed via UNIQUE constraint below so lookups by
   * ownerId are O(log n) without a join.
   */
  @Column({ type: 'uuid', unique: true })
  ownerId: string;

  /**
   * Ordered list of pipeline stages, stored as JSONB.
   * The 'rejected' stage (isRejected=true) is always present; the service
   * enforces its presence on every write.
   */
  @Column({ type: 'jsonb' })
  stages: PipelineStage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
