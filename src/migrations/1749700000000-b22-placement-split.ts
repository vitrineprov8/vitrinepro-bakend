import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B22 — split de placement negociável por empresa.
 *
 *   users.placementPlatformSharePercent (int, nullable — null = usa o
 *   default global de 25%, ver `DEFAULT_PLATFORM_SHARE_PERCENT`)
 *   users.placementSplitHistory (jsonb, default []) — histórico de mudanças
 *   com motivo obrigatório (admin que mudou, valor anterior/novo, motivo)
 *
 *   placements.platformSharePercentApplied (int, nullable) — percentual
 *   efetivamente congelado em cada placement no momento da criação (P1),
 *   pra auditoria — renegociações futuras não alteram placements já criados.
 */
export class B22PlacementSplit1749700000000 implements MigrationInterface {
  name = 'B22PlacementSplit1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "placementPlatformSharePercent" INT NULL,
        ADD COLUMN IF NOT EXISTS "placementSplitHistory" JSONB NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      ALTER TABLE "placements"
        ADD COLUMN IF NOT EXISTS "platformSharePercentApplied" INT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "placements"
        DROP COLUMN IF EXISTS "platformSharePercentApplied"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "placementSplitHistory",
        DROP COLUMN IF EXISTS "placementPlatformSharePercent"
    `);
  }
}
