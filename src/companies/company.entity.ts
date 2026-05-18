import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  industry: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * The recruiter who owns/manages this client company.
   * Cascades on user deletion so no orphan rows remain.
   */
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'uuid' })
  ownerId: string;

  /**
   * Recruiters from the owner's team assigned to manage this client.
   * Each must be an ACTIVE team member of the owner.
   */
  @ManyToMany(() => User)
  @JoinTable({
    name: 'company_recruiters',
    joinColumn: { name: 'companyId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  assignedRecruiters: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
