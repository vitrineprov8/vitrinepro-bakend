import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B17 — verificação de e-mail.
 *
 *   users.emailVerified (boolean, default false)
 *   users.emailVerificationToken / emailVerificationExpiresAt (token de uso
 *   único, 24h, mesmo padrão de passwordResetToken do B2)
 *
 * Contas OAuth (Google/LinkedIn) nascem com emailVerified=true (o provedor já
 * validou o e-mail) — tratado em `AuthService.validateOAuthUser`, não aqui.
 * Contas locais existentes antes desta migração ficam com emailVerified=false
 * até confirmarem o e-mail ou reenviarem o token via `POST /auth/resend-verification`.
 */
export class B17EmailVerification1749400000000 implements MigrationInterface {
  name = 'B17EmailVerification1749400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_emailVerificationToken"
        ON "users" ("emailVerificationToken")
        WHERE "emailVerificationToken" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_emailVerificationToken"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "emailVerificationExpiresAt",
        DROP COLUMN IF EXISTS "emailVerificationToken",
        DROP COLUMN IF EXISTS "emailVerified"
    `);
  }
}
