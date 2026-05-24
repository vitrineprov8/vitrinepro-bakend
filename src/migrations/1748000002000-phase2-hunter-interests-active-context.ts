import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 migration — HunterInterest table + User.activeContextTeamId
 *
 * Changes:
 *   1. users: add activeContextTeamId UUID NULL
 *   2. CREATE TABLE hunter_interests (vagaId, hunterUserId, status enum, unique)
 */
export class Phase2HunterInterestsActiveContext1748000002000
  implements MigrationInterface
{
  name = 'Phase2HunterInterestsActiveContext1748000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. users — active context field ──────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "activeContextTeamId" UUID NULL
    `);

    // No FK constraint here — teams can be deleted without orphaning the user.
    // The service validates membership before accepting a non-null value.
    // An index helps the profile-load path if we ever query by this field.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_activeContextTeamId"
        ON "users" ("activeContextTeamId")
        WHERE "activeContextTeamId" IS NOT NULL
    `);

    // ── 2. hunter_interests table ─────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "hunter_interest_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hunter_interests" (
        "id"            UUID                          NOT NULL DEFAULT uuid_generate_v4(),
        "vagaId"        UUID                          NOT NULL,
        "hunterUserId"  UUID                          NOT NULL,
        "status"        "hunter_interest_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt"     TIMESTAMP                     NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP                     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hunter_interests"              PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hunter_interests_vaga_hunter"  UNIQUE ("vagaId", "hunterUserId"),
        CONSTRAINT "FK_hunter_interests_vaga"
          FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hunter_interests_hunter"
          FOREIGN KEY ("hunterUserId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Index on vagaId — used by GET /vagas/:id/hunter-interests (vaga owner view)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hunter_interests_vagaId"
        ON "hunter_interests" ("vagaId")
    `);

    // Index on hunterUserId — used by GET /me/hunter-interests
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hunter_interests_hunterUserId"
        ON "hunter_interests" ("hunterUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // hunter_interests
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hunter_interests_hunterUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hunter_interests_vagaId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hunter_interests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hunter_interest_status_enum"`);

    // users
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_activeContextTeamId"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "activeContextTeamId"
    `);
  }
}
