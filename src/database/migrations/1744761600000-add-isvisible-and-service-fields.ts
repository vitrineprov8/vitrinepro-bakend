import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: add-isvisible-and-service-fields
 *
 * 1. users.isVisible (boolean, default true) — lets users hide their profile
 *    from the public Vitrine and search results.
 *
 * 2. portfolio_items service fields:
 *    - isService          (boolean, default false)
 *    - serviceType        (varchar(100), nullable)
 *    - actionButton       (varchar(50), nullable)
 *    - servicePrice       (numeric(10,2), nullable)
 *    - publicationDurationDays (int, nullable, max 30)
 *
 * Indexes added:
 *   - idx_users_isvisible   — supports fast filtering in public profile/search queries
 *   - idx_portfolio_isservice — supports filtering service vs. portfolio items
 */
export class AddIsvisibleAndServiceFields1744761600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- users.isVisible ---
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "isVisible" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_isvisible
        ON users ("isVisible")
    `);

    // --- portfolio_items service fields ---
    await queryRunner.query(`
      ALTER TABLE portfolio_items
        ADD COLUMN IF NOT EXISTS "isService" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "serviceType" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "actionButton" varchar(50) NULL,
        ADD COLUMN IF NOT EXISTS "servicePrice" numeric(10, 2) NULL,
        ADD COLUMN IF NOT EXISTS "publicationDurationDays" int NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_isservice
        ON portfolio_items ("isService")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_isservice`);

    await queryRunner.query(`
      ALTER TABLE portfolio_items
        DROP COLUMN IF EXISTS "publicationDurationDays",
        DROP COLUMN IF EXISTS "servicePrice",
        DROP COLUMN IF EXISTS "actionButton",
        DROP COLUMN IF EXISTS "serviceType",
        DROP COLUMN IF EXISTS "isService"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_isvisible`);

    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS "isVisible"
    `);
  }
}
