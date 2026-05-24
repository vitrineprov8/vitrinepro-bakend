import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';

export enum HunterInterestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('hunter_interests')
@Unique(['vagaId', 'hunterUserId'])
export class HunterInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Vaga, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga;

  @Column({ type: 'uuid' })
  vagaId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'hunterUserId' })
  hunterUser: User;

  @Column({ type: 'uuid' })
  hunterUserId: string;

  @Column({
    type: 'enum',
    enum: HunterInterestStatus,
    default: HunterInterestStatus.PENDING,
  })
  status: HunterInterestStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
