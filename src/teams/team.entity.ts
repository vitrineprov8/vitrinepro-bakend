import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TeamMember } from './team-member.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** T-T01/T-T08 — Perfil da consultoria (logo, CNPJ opcional, bio pública). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cnpj: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  /**
   * The user who owns this team (the plan subscriber).
   * One user → one team (enforced by unique constraint on ownerId).
   * Cascades on user deletion so no orphan team rows remain.
   */
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'uuid', unique: true })
  ownerId: string;

  @OneToMany(() => TeamMember, (member) => member.team)
  members: TeamMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
