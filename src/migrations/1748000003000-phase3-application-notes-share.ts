import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 migration — VagaApplication enriched fields + ProcessShareLink table
 *
 * Changes:
 *   1. vaga_applications: add generalScore, generalNote, stageHistory, stageNotes
 *   2. CREATE TABLE process_share_links (applicationId FK, token unique, ...)
 */
export class Phase3ApplicationNotesShare1748000003000
  implements MigrationInterface
{
  name = 'Phase3ApplicationNotesShare1748000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. vaga_applications — enriched fields ────────────────────────────────

    // Numeric score 0.0–10.0, 1 decimal place
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "generalScore" DECIMAL(3,1) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "generalNote" TEXT NULL
    `);

    // stageHistory: ordered array of stage-transition events
    // [{stage: string, enteredAt: ISO, byUserId: uuid, note?: string}]
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "stageHistory" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    // stageNotes: keyed by stageKey, contains recruiter notes/rating per stage
    // { "<stageKey>": { observacoes: string, nota: number|null, updatedAt, byUserId } }
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "stageNotes" JSONB NOT NULL DEFAULT '{}'::jsonb
    `);

    // GIN index on stageHistory for future JSONB queries (e.g. filter by stage)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaga_applications_stageHistory_gin"
        ON "vaga_applications" USING GIN ("stageHistory")
    `);

    // ── 2. process_share_links table ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "process_share_links" (
        "id"             UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "applicationId"  UUID         NOT NULL,
        "token"          VARCHAR(64)  NOT NULL,
        "expiresAt"      TIMESTAMP    NULL,
        "createdById"    UUID         NOT NULL,
        "revokedAt"      TIMESTAMP    NULL,
        "createdAt"      TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_process_share_links"        PRIMARY KEY ("id"),
        CONSTRAINT "UQ_process_share_links_token"  UNIQUE ("token"),
        CONSTRAINT "FK_process_share_links_app"
          FOREIGN KEY ("applicationId")
            REFERENCES "vaga_applications"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_process_share_links_creator"
          FOREIGN KEY ("createdById")
            REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Index on applicationId — used by POST /applications/:id/share and listing
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_share_links_applicationId"
        ON "process_share_links" ("applicationId")
    `);

    // Partial index on token for the hot-path public lookup (only active tokens)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_process_share_links_token_active"
        ON "process_share_links" ("token")
        WHERE "revokedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // process_share_links
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_process_share_links_token_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_process_share_links_applicationId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "process_share_links"`);

    // vaga_applications
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vaga_applications_stageHistory_gin"`,
    );
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        DROP COLUMN IF EXISTS "stageNotes",
        DROP COLUMN IF EXISTS "stageHistory",
        DROP COLUMN IF EXISTS "generalNote",
        DROP COLUMN IF EXISTS "generalScore"
    `);
  }
}
