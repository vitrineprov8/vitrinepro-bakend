import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Tag } from '../tags/tag.entity';

export enum ArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

@Entity('articles')
export class Article {
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

  @Column({ type: 'jsonb', default: {} })
  content: object;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageKey: string | null;

  @Column({ type: 'int', nullable: true })
  readTime: number | null;

  @Column({ type: 'enum', enum: ArticleStatus, default: ArticleStatus.DRAFT })
  status: ArticleStatus;

  @Column({ type: 'text', nullable: true })
  conclusion: string | null;

  @ManyToMany(() => Tag, { cascade: true, eager: false })
  @JoinTable({ name: 'article_tags' })
  tags: Tag[];

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
