import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: search-indexes
 *
 * Enables the pg_trgm extension and creates GIN + B-tree indexes to support
 * the fuzzy full-text search feature (similarity scoring, LIKE filters).
 *
 * GIN/trigram indexes accelerate LIKE '%term%' and similarity() calls on
 * large text columns. B-tree indexes support fast equality/range filtering
 * on status, coverImageUrl, createdAt and year.
 */
export class SearchIndexes1711350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm for similarity() and GIN trigram indexes
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // GIN trigram indexes — users table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_fullname_gin
        ON users USING GIN ((LOWER("firstName" || ' ' || "lastName")) gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_profession_gin
        ON users USING GIN (LOWER(profession) gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_location_gin
        ON users USING GIN (LOWER(location) gin_trgm_ops)
    `);

    // GIN trigram indexes — portfolio_items table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_title_gin
        ON portfolio_items USING GIN (LOWER(title) gin_trgm_ops)
    `);
    // GIN trigram index — tags table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tags_name_gin
        ON tags USING GIN (LOWER(name) gin_trgm_ops)
    `);

    // B-tree indexes — portfolio_items filters & sorts
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_status
        ON portfolio_items (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_cover_notnull
        ON portfolio_items ("coverImageUrl") WHERE "coverImageUrl" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_createdat
        ON portfolio_items ("createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_year
        ON portfolio_items (year)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_projectstatus
        ON portfolio_items ("projectStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_projectstatus`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_year`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_createdat`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_cover_notnull`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tags_name_gin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_title_gin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_location_gin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_profession_gin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_fullname_gin`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS pg_trgm`);
  }
}
