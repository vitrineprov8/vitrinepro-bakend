import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B5 — Perfil público de hunter + B8 — Verificação de hunter.
 *
 * Reaproveita a tabela `users` (mesmo padrão do B1/B4) em vez de criar
 * entidades novas — o hunter já é um `User`, e os campos abaixo são um
 * "acréscimo de persona", não uma entidade separada.
 *
 * B5:
 *  - `hunterSpecialties`: chips de especialidade/segmento (simple-array, texto livre).
 *  - `hunterYearsExperience`: anos de experiência (inteiro, opcional).
 *  (headline/bio/cidade/toggle-visível já existem: `profession`, `bio`, `location`, `isVisible`).
 *
 * B8:
 *  - `verificationStatus`: NONE (nunca pediu) | PENDING | APPROVED | REJECTED.
 *  - `verificationDocs`: jsonb, array de { url, label, uploadedAt }.
 *  - `verificationLinkedinUrl`, `verificationRequestedAt`, `verificationDecidedAt`,
 *    `verificationRejectionReason`.
 */
export class B5B8HunterProfileVerification1749300000000
  implements MigrationInterface
{
  name = 'B5B8HunterProfileVerification1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hunterSpecialties" TEXT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hunterYearsExperience" INTEGER NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationStatus" VARCHAR(16) NOT NULL DEFAULT 'NONE'
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationDocs" JSONB NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationLinkedinUrl" VARCHAR(500) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationRequestedAt" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationDecidedAt" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verificationRejectionReason" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationRejectionReason"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationDecidedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationRequestedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationLinkedinUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationDocs"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verificationStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "hunterYearsExperience"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "hunterSpecialties"
    `);
  }
}
