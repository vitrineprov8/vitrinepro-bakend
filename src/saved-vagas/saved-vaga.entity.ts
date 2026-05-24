import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Vaga } from '../vagas/vaga.entity';

@Entity('saved_vagas')
@Unique('UQ_saved_vagas_user_vaga', ['userId', 'vagaId'])
export class SavedVaga {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_saved_vagas_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index('IDX_saved_vagas_vagaId')
  @Column({ type: 'uuid' })
  vagaId: string;

  /**
   * When the vaga is hard-deleted, saved records are also removed via CASCADE
   * so the user never sees a dangling bookmark.
   */
  @ManyToOne(() => Vaga, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vagaId' })
  vaga: Vaga;

  @CreateDateColumn()
  createdAt: Date;
}
