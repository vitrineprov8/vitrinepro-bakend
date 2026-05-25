import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SEO Layer 4 — slug_tombstones table
 *
 * Tracks deleted/hidden/renamed slugs so the frontend can return the
 * semantically correct HTTP status (410 Gone vs 404 Not Found vs 301 Redirect)
 * for URLs that Google has already indexed.
 *
 * Design decisions:
 *  - UNIQUE(type, slug): ensures one tombstone per content unit; enables safe
 *    upsert without race conditions on concurrent deletes.
 *  - Composite index on (type, slug) covers the hot-path lookup. A partial
 *    index with WHERE expiresAt > NOW() is not possible because NOW() is not
 *    IMMUTABLE in Postgres index predicates (error 42P17). The daily purge
 *    cron keeps the table small, so the composite index is sufficient.
 *  - expiresAt: tombstones auto-expire after 180 days. A daily cron purges
 *    expired rows so the table stays small indefinitely.
 */
export class SlugTombstones1748500000000 implements MigrationInterface {
  name = 'SlugTombstones1748500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "slug_tombstones" (
        "id"         UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "type"       VARCHAR(20)   NOT NULL,
        "slug"       VARCHAR(255)  NOT NULL,
        "reason"     VARCHAR(20)   NOT NULL,
        "redirectTo" VARCHAR(500)  NULL,
        "createdAt"  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "expiresAt"  TIMESTAMPTZ   NOT NULL,
        CONSTRAINT "PK_slug_tombstones" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_slug_tombstones_type_slug" UNIQUE ("type", "slug")
      )
    `);

    // Composite index — covers the hot-path lookup by (type, slug).
    // The expiresAt filter is applied at query time, not in the index.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_slug_tombstones_lookup"
        ON "slug_tombstones" ("type", "slug")
    `);

    // Index on expiresAt for the daily purge cron (DELETE WHERE expiresAt < NOW()).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_slug_tombstones_expiresAt"
        ON "slug_tombstones" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_slug_tombstones_expiresAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_slug_tombstones_lookup"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "slug_tombstones"`);
  }
}
