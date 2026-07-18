import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B27 — 2FA (TOTP) para todas as contas, obrigatório para `role=ADMIN`.
 *
 * Só adiciona colunas em `users` — nenhuma tabela nova. Os códigos de
 * recuperação vão em `jsonb` (array de hashes bcrypt) em vez de tabela
 * própria: são no máximo 10 por usuário, sempre lidos/escritos junto com o
 * resto da conta, e nunca consultados isoladamente.
 */
export class B27TwoFactorAuth1752300000000 implements MigrationInterface {
  name = 'B27TwoFactorAuth1752300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "twoFactorSecret" varchar(64) NULL,
        ADD COLUMN IF NOT EXISTS "twoFactorPendingSecret" varchar(64) NULL,
        ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" jsonb NULL,
        ADD COLUMN IF NOT EXISTS "twoFactorEnabledAt" timestamp NULL
    `);

    // Índice parcial: as únicas queries por essa coluna são "quem tem 2FA
    // ligado" (métrica/admin). A esmagadora maioria das linhas é `false`, então
    // um índice parcial fica minúsculo comparado a um índice completo.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_twoFactorEnabled"
        ON "users" ("twoFactorEnabled") WHERE "twoFactorEnabled" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_twoFactorEnabled"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "twoFactorEnabled",
        DROP COLUMN IF EXISTS "twoFactorSecret",
        DROP COLUMN IF EXISTS "twoFactorPendingSecret",
        DROP COLUMN IF EXISTS "twoFactorBackupCodes",
        DROP COLUMN IF EXISTS "twoFactorEnabledAt"
    `);
  }
}
