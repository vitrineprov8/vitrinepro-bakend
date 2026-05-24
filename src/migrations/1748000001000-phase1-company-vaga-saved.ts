import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 migration — Company accounts, Vaga segments/hunters, SavedVaga, SavedFilter
 *
 * Changes:
 *   1. users: add isCompany, companyName, companyIndustry, companyLogoUrl
 *   2. vagas:  add segment, allowHunters, hunterContactPhone
 *   3. CREATE TABLE saved_vagas (userId, vagaId, unique, cascade FK on both)
 *   4. CREATE TABLE saved_filters (userId, name, filters JSONB, isDefault, position)
 */
export class Phase1CompanyVagaSaved1748000001000 implements MigrationInterface {
  name = 'Phase1CompanyVagaSaved1748000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. users — company fields ─────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "isCompany"        BOOLEAN      NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "companyName"       VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS "companyIndustry"   VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS "companyLogoUrl"    VARCHAR(500) NULL
    `);

    // ── 2. vagas — segment + hunter fields ───────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vagas"
        ADD COLUMN IF NOT EXISTS "segment"            VARCHAR(50)  NULL,
        ADD COLUMN IF NOT EXISTS "allowHunters"       BOOLEAN      NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "hunterContactPhone" VARCHAR(50)  NULL
    `);

    // Index on segment for Radar filter queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vagas_segment"
        ON "vagas" ("segment")
        WHERE "segment" IS NOT NULL
    `);

    // ── 3. saved_vagas table ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_vagas" (
        "id"        UUID      NOT NULL DEFAULT uuid_generate_v4(),
        "userId"    UUID      NOT NULL,
        "vagaId"    UUID      NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_vagas"         PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_vagas_user_vaga" UNIQUE ("userId", "vagaId"),
        CONSTRAINT "FK_saved_vagas_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_saved_vagas_vaga"
          FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saved_vagas_userId"
        ON "saved_vagas" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saved_vagas_vagaId"
        ON "saved_vagas" ("vagaId")
    `);

    // ── 4. saved_filters table ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_filters" (
        "id"        UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "userId"    UUID         NOT NULL,
        "name"      VARCHAR(100) NOT NULL,
        "filters"   JSONB        NOT NULL,
        "isDefault" BOOLEAN      NOT NULL DEFAULT FALSE,
        "position"  INTEGER      NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_filters" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saved_filters_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saved_filters_userId"
        ON "saved_filters" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // saved_filters
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_filters_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_filters"`);

    // saved_vagas
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_vagas_vagaId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_vagas_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_vagas"`);

    // vagas columns
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vagas_segment"`);
    await queryRunner.query(`
      ALTER TABLE "vagas"
        DROP COLUMN IF EXISTS "hunterContactPhone",
        DROP COLUMN IF EXISTS "allowHunters",
        DROP COLUMN IF EXISTS "segment"
    `);

    // users columns
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "companyLogoUrl",
        DROP COLUMN IF EXISTS "companyIndustry",
        DROP COLUMN IF EXISTS "companyName",
        DROP COLUMN IF EXISTS "isCompany"
    `);
  }
}
