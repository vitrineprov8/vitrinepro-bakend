import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: pipeline-templates
 *
 * Creates the `pipeline_templates` table that stores one custom pipeline
 * template per recruiter (1-to-1 with users).
 *
 * Design decisions:
 *  - Stages are stored as a JSONB array — avoids a separate stages table and
 *    allows atomic replace-all updates with a single row write.
 *  - UNIQUE constraint on `ownerId` enforces the 1-to-1 invariant at the DB
 *    level and also doubles as the primary lookup index (no join needed).
 *  - No backfill: templates are lazy-initialised when a recruiter first calls
 *    GET /me/pipeline-template, so all existing users will receive the default
 *    stages on their first visit without any migration data risk.
 *
 * down() fully reverts the migration.
 */
export class PipelineTemplates1747000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pipeline_templates" (
        "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
        "ownerId"    UUID        NOT NULL,
        "stages"     JSONB       NOT NULL DEFAULT '[]',
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_pipeline_templates"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_pipeline_templates_ownerId"
          UNIQUE ("ownerId"),

        CONSTRAINT "FK_pipeline_templates_owner"
          FOREIGN KEY ("ownerId")
          REFERENCES "users"("id")
          ON DELETE CASCADE
      );
    `);

    /*
     * GIN index on stages JSONB enables efficient containment queries such as
     *   WHERE stages @> '[{"id":"para_analisar"}]'
     * Useful for future analytics or validation queries.
     */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pipeline_templates_stages_gin"
        ON "pipeline_templates" USING GIN ("stages");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pipeline_templates_stages_gin";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "pipeline_templates";`);
  }
}
