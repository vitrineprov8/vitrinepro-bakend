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
import { Team } from './team.entity';

export enum TeamRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  RECRUITER = 'RECRUITER',
}

export enum TeamMemberStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
}

/**
 * Represents a member of a Team.
 *
 * A TeamMember can be:
 *  - PENDING (invited by email, user has not accepted yet) → userId is null
 *  - ACTIVE  (accepted invite) → userId is populated
 *
 * Unique constraint on (teamId, userId) prevents duplicate active entries.
 * invitedEmail is stored so that when the invited user signs up / accepts,
 * we can match them by email.
 */
@Entity('team_members')
@Unique(['teamId', 'userId'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({ type: 'uuid' })
  teamId: string;

  /**
   * The resolved user account, populated when the invite is accepted.
   * Null while the invite is still PENDING.
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Email address the invite was sent to (stored for accept-by-email matching). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  invitedEmail: string | null;

  @Column({ type: 'enum', enum: TeamRole, default: TeamRole.RECRUITER })
  role: TeamRole;

  @Column({ type: 'enum', enum: TeamMemberStatus, default: TeamMemberStatus.PENDING })
  status: TeamMemberStatus;

  /**
   * B7 — token de uso único enviado por e-mail ao convidado, usado pela
   * página pública `/convite/[token]`. Null depois de aceito (one-time use).
   */
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  inviteToken: string | null;

  /** Timestamp of initial invite (or team creation for the OWNER row). */
  @CreateDateColumn()
  joinedAt: Date;
}
