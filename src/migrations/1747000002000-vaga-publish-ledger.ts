import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: vaga-publish-ledger
 *
 * Introduces the anti-abuse publish-slot accounting system for vagas:
 *
 *  1. Adds `published_at TIMESTAMPTZ NULL` to the `vagas` table.
 *     This records the first publication timestamp of each vaga.
 *
 *  2. Creates the `vaga_publish_ledger` table — an append-only log of publish
 *     events keyed by (userId, vagaId, cycleStart).  Records here are never
 *     deleted (vagaId FK is SET NULL when the vaga is deleted), so the slot
 *     consumption is irreversible even after deletion.
 *
 *  3. Backfills ledger rows for every existing PUBLISHED vaga so that current
 *     users are not surprised by a sudden "used = 0" counter on deploy.
 *     Cycle boundaries are approximated from each user's planExpiresAt:
 *       - If a paid plan is active: cycleEnd = planExpiresAt, cycleStart = planExpiresAt - 30d
 *       - Otherwise: current UTC calendar month
 *
 * down() is fully implemented and reverts all changes.
 */
export class VagaPublishLedger1747000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------------
    // 1. Add published_at column to vagas
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "vagas"
        ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ NULL;
    `);

    // Backfill publishedAt for already-published vagas using createdAt as proxy
    await queryRunner.query(`
      UPDATE "vagas"
      SET "published_at" = "createdAt"
      WHERE "status" = 'PUBLISHED' AND "published_at" IS NULL;
    `);

    // ----------------------------------------------------------------
    // 2. Create vaga_publish_ledger table
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vaga_publish_ledger" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "userId"      UUID        NOT NULL,
        "vagaId"      UUID        NULL,
        "cycleStart"  TIMESTAMPTZ NOT NULL,
        "cycleEnd"    TIMESTAMPTZ NOT NULL,
        "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_vaga_publish_ledger" PRIMARY KEY ("id"),

        CONSTRAINT "FK_vaga_publish_ledger_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_vaga_publish_ledger_vaga"
          FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE SET NULL
      );
    `);

    // ----------------------------------------------------------------
    // 3. Indexes
    //
    //    Primary query pattern: WHERE userId = ? AND cycleStart = ?
    //    The unique partial index prevents double-counting the same vaga
    //    in the same cycle while allowing NULL vagaId rows (deleted vagas).
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_userId_cycleStart"
        ON "vaga_publish_ledger" ("userId", "cycleStart");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_user_vaga_cycle"
        ON "vaga_publish_ledger" ("userId", "vagaId", "cycleStart")
        WHERE "vagaId" IS NOT NULL;
    `);

    // ----------------------------------------------------------------
    // 4. Backfill: one ledger row per existing PUBLISHED vaga
    //
    //    For users with an active paid plan: use a rolling 30-day cycle
    //    ending at planExpiresAt.  For FREE / expired users: use the
    //    current UTC calendar month.
    //
    //    ON CONFLICT DO NOTHING is a safety net in case this migration
    //    is run more than once (idempotent).
    // ----------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO "vaga_publish_ledger" ("userId", "vagaId", "cycleStart", "cycleEnd", "publishedAt")
      SELECT
        v."createdById"                                    AS "userId",
        v."id"                                             AS "vagaId",
        CASE
          WHEN u."plan_status" = 'ACTIVE'
               AND u."plan_expires_at" IS NOT NULL
               AND u."plan_expires_at" > now()
          THEN u."plan_expires_at" - INTERVAL '30 days'
          ELSE date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        END                                                AS "cycleStart",
        CASE
          WHEN u."plan_status" = 'ACTIVE'
               AND u."plan_expires_at" IS NOT NULL
               AND u."plan_expires_at" > now()
          THEN u."plan_expires_at"
          ELSE (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC'
        END                                                AS "cycleEnd",
        COALESCE(v."createdAt", now())                     AS "publishedAt"
      FROM "vagas" v
      JOIN "users" u ON u."id" = v."createdById"
      WHERE v."status" = 'PUBLISHED'
        AND v."createdById" IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop table (also drops indexes and FK constraints)
    await queryRunner.query(`DROP TABLE IF EXISTS "vaga_publish_ledger";`);

    // Remove published_at from vagas
    await queryRunner.query(`
      ALTER TABLE "vagas" DROP COLUMN IF EXISTS "published_at";
    `);
  }
}
