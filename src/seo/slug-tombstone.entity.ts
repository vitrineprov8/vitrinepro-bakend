import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TombstoneType {
  PORTFOLIO = 'portfolio',
  PROFILE = 'profile',
  VAGA = 'vaga',
}

export enum TombstoneReason {
  DELETED = 'deleted',
  RENAMED = 'renamed',
  HIDDEN = 'hidden',
}

/**
 * Tracks slugs/usernames that no longer resolve to live content so that the
 * frontend can return the correct HTTP status:
 *   - 410 Gone  → reason is 'deleted' or 'hidden' (content intentionally removed)
 *   - 301/308   → reason is 'renamed' and redirectTo is set
 *
 * Tombstones expire after 180 days (configurable via expiresAt).  A daily cron
 * purges rows past their expiry so the table stays small.
 *
 * Uniqueness is enforced at the DB level on (type, slug) so concurrent deletes
 * are safe — upserts are idempotent.
 */
@Entity('slug_tombstones')
@Index('IDX_slug_tombstones_lookup', ['type', 'slug'])
export class SlugTombstone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: TombstoneType;

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 20 })
  reason: TombstoneReason;

  /**
   * Populated only when reason === 'renamed'.
   * Stores the full relative URL of the new destination,
   * e.g. "/portfolio/novo-slug" or "/perfil/novo-username".
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  redirectTo: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
