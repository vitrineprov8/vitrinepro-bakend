import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B10 — avaliações de hunter (hunter_reviews). RN-NOVA-07: 1 review por
 * placement, imutável, alimenta o perfil público do hunter (B5).
 */
export class B10HunterReviews1749900000000 implements MigrationInterface {
  name = 'B10HunterReviews1749900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hunter_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "placementId" uuid NOT NULL,
        "hunterId" uuid NOT NULL,
        "vagaId" uuid NULL,
        "reviewedById" uuid NOT NULL,
        "rating" int NOT NULL,
        "comment" text NULL,
        "tags" text NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_hunter_reviews_placementId" ON "hunter_reviews" ("placementId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hunter_reviews_hunterId" ON "hunter_reviews" ("hunterId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hunter_reviews"`);
  }
}
