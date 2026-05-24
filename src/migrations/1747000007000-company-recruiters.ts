import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: company_recruiters join table
 *
 * Many-to-many between companies (clients) and users (recruiters).
 * Used to designate which recruiters in the team are responsible
 * for a given client. Cascades on either side deletion.
 */
export class CompanyRecruiters1747000007000 implements MigrationInterface {
  name = 'CompanyRecruiters1747000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_recruiters" (
        "companyId"  UUID NOT NULL,
        "userId"     UUID NOT NULL,
        CONSTRAINT "PK_company_recruiters" PRIMARY KEY ("companyId", "userId"),
        CONSTRAINT "FK_company_recruiters_company"
          FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_recruiters_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_company_recruiters_companyId" ON "company_recruiters" ("companyId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_company_recruiters_userId" ON "company_recruiters" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_recruiters_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_company_recruiters_companyId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company_recruiters"`);
  }
}
