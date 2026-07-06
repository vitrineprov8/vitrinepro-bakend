import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B16 — limpeza: remove os campos de "Service offering" de portfolio_items
 * (isService, serviceType, actionButton, servicePrice, publicationDurationDays).
 *
 * Esses campos foram adicionados pela migração
 * `1744761600000-add-isvisible-and-service-fields` mas nunca tiveram UI no
 * frontend (zero usos confirmados via grep em vitrinepro-frontend-v2) — a
 * feature de "serviços" no portfólio nunca foi construída de fato. Removidos
 * junto com todo o código relacionado (entity, DTOs, portfolio.service,
 * search.service/search-query.dto) em 2026-07-06.
 *
 * down() recria as colunas (não os dados, que se perdem) — mesmo padrão de
 * reversibilidade das outras migrações deste projeto.
 */
export class B16CleanupServiceFields1749500000000 implements MigrationInterface {
  name = 'B16CleanupServiceFields1749500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_portfolio_isservice`);
    await queryRunner.query(`
      ALTER TABLE portfolio_items
        DROP COLUMN IF EXISTS "publicationDurationDays",
        DROP COLUMN IF EXISTS "servicePrice",
        DROP COLUMN IF EXISTS "actionButton",
        DROP COLUMN IF EXISTS "serviceType",
        DROP COLUMN IF EXISTS "isService"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE portfolio_items
        ADD COLUMN IF NOT EXISTS "isService" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "serviceType" varchar(100) NULL,
        ADD COLUMN IF NOT EXISTS "actionButton" varchar(50) NULL,
        ADD COLUMN IF NOT EXISTS "servicePrice" numeric(10, 2) NULL,
        ADD COLUMN IF NOT EXISTS "publicationDurationDays" int NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_isservice
        ON portfolio_items ("isService")
    `);
  }
}
