import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PortfolioItem } from './portfolio.entity';

export enum PortfolioFileType {
  IMAGE = 'IMAGE',
  PDF = 'PDF',
}

@Entity('portfolio_files')
export class PortfolioFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PortfolioItem, (item) => item.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolioItemId' })
  portfolioItem: PortfolioItem;

  @Column({ type: 'uuid' })
  portfolioItemId: string;

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  @Column({ type: 'enum', enum: PortfolioFileType })
  fileType: PortfolioFileType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  caption: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFilename: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;
}
