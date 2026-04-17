import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: add-isfeatured-to-portfolio-items
 *
 * Adds a boolean `isFeatured` column to `portfolio_items`.
 * Only one item per user may be featured at a time; this constraint is
 * enforced at the service layer, not at the DB level, to allow atomic
 * swaps without transient unique-constraint violations.
 *
 * Index added:
 *   - idx_portfolio_isfeatured — supports fast lookup of the featured item
 *     on the public profile page (WHERE "isFeatured" = true AND "userId" = ?)
 */
export class AddIsfeaturedToPortfolioItems1744848000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE portfolio_items
        ADD COLUMN IF NOT EXISTS "isFeatured" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_isfeatured
        ON portfolio_items ("userId", "isFeatured")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_isfeatured`);

    await queryRunner.query(`
      ALTER TABLE portfolio_items
        DROP COLUMN IF EXISTS "isFeatured"
    `);
  }
}
