import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: companies table + vagas.company_id FK
 *
 * Creates the `companies` table to hold client companies owned by recruiters.
 * Adds `company_id` to `vagas` as a nullable FK (SET NULL on company deletion).
 */
export class Companies1747000005000 implements MigrationInterface {
  name = 'Companies1747000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── companies table ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id"          UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "name"        VARCHAR(255)  NOT NULL,
        "logoUrl"     VARCHAR(500),
        "industry"    VARCHAR(255),
        "description" TEXT,
        "ownerId"     UUID          NOT NULL,
        "createdAt"   TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_companies_owner"
          FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Index on ownerId for fast owner-scoped queries
    await queryRunner.query(`
      CREATE INDEX "IDX_companies_ownerId" ON "companies" ("ownerId")
    `);

    // ── vagas.company_id FK ──────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vagas"
        ADD COLUMN IF NOT EXISTS "companyId" UUID,
        ADD CONSTRAINT "FK_vagas_company"
          FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vagas"
        DROP CONSTRAINT IF EXISTS "FK_vagas_company",
        DROP COLUMN IF EXISTS "companyId"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_ownerId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
  }
}
