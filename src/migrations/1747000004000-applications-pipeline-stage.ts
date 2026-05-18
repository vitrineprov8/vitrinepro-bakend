import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: applications-pipeline-stage
 *
 * Replaces the rigid `status` enum column on `vaga_applications` with two
 * free-form columns that power the customisable kanban pipeline:
 *
 *  - `pipeline_stage VARCHAR(64)` — a logical reference to a stage `id` in
 *    the recruiter's PipelineTemplate (not a hard FK; template stages are
 *    user-editable strings).
 *  - `is_rejected BOOLEAN` — denormalised flag for fast rejection queries.
 *
 * Backfill mapping (best-effort):
 *   PENDING   → pipeline_stage = 'para_analisar', is_rejected = false
 *   REVIEWED  → pipeline_stage = 'analisados',    is_rejected = false
 *   ACCEPTED  → pipeline_stage = 'entrev_final',  is_rejected = false
 *   REJECTED  → pipeline_stage = 'para_analisar', is_rejected = true
 *
 * down() fully reverts: re-creates the enum and maps back with best-effort
 * reverse logic (is_rejected=true → REJECTED; others → PENDING).
 */
export class ApplicationsPipelineStage1747000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Add new columns with safe defaults ────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "pipeline_stage" VARCHAR(64) NOT NULL DEFAULT 'para_analisar',
        ADD COLUMN IF NOT EXISTS "is_rejected"    BOOLEAN     NOT NULL DEFAULT false;
    `);

    // ── 2. Backfill from existing status values ──────────────────────────────
    await queryRunner.query(`
      UPDATE "vaga_applications"
        SET "pipeline_stage" = 'para_analisar', "is_rejected" = false
      WHERE "status" = 'PENDING';
    `);

    await queryRunner.query(`
      UPDATE "vaga_applications"
        SET "pipeline_stage" = 'analisados', "is_rejected" = false
      WHERE "status" = 'REVIEWED';
    `);

    await queryRunner.query(`
      UPDATE "vaga_applications"
        SET "pipeline_stage" = 'entrev_final', "is_rejected" = false
      WHERE "status" = 'ACCEPTED';
    `);

    await queryRunner.query(`
      UPDATE "vaga_applications"
        SET "pipeline_stage" = 'para_analisar', "is_rejected" = true
      WHERE "status" = 'REJECTED';
    `);

    // ── 3. Index on (vagaId, pipelineStage) for the kanban board query ───────
    //       The board always loads all applications for one vaga, grouped by
    //       stage — this composite index covers that pattern exactly.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaga_applications_pipelineStage"
        ON "vaga_applications" ("vagaId", "pipeline_stage");
    `);

    // ── 4. Index on is_rejected for "show rejected" filter ───────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaga_applications_isRejected"
        ON "vaga_applications" ("vagaId", "is_rejected")
        WHERE "is_rejected" = true;
    `);

    // ── 5. Drop the old status column and its enum type ──────────────────────
    //       Column is dropped first; then the type (Postgres requires this order).
    await queryRunner.query(`
      ALTER TABLE "vaga_applications" DROP COLUMN IF EXISTS "status";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "vaga_applications_status_enum";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Re-create the enum type ───────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "vaga_applications_status_enum"
          AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ── 2. Re-add the status column ──────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "status"
          "vaga_applications_status_enum" NOT NULL DEFAULT 'PENDING';
    `);

    // ── 3. Reverse-map pipeline data back to enum values ─────────────────────
    //       is_rejected=true → REJECTED; everything else → PENDING
    //       (REVIEWED and ACCEPTED state is lost — acceptable for a down migration)
    await queryRunner.query(`
      UPDATE "vaga_applications"
        SET "status" = 'REJECTED'
      WHERE "is_rejected" = true;
    `);

    await queryRunner.query(`
      UPDATE "vaga_applications"
        SET "status" = 'PENDING'
      WHERE "is_rejected" = false;
    `);

    // ── 4. Drop indexes ──────────────────────────────────────────────────────
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vaga_applications_isRejected";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vaga_applications_pipelineStage";`,
    );

    // ── 5. Drop new columns ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        DROP COLUMN IF EXISTS "is_rejected",
        DROP COLUMN IF EXISTS "pipeline_stage";
    `);
  }
}
