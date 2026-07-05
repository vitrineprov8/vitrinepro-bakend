import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B2 + B7 — tokens de redefinição de senha e convite de time.
 *
 *   1. users.passwordResetToken / passwordResetExpiresAt (B2)
 *   2. team_members.inviteToken (B7)
 *
 * Ambos são tokens de uso único, lidos via índice parcial (WHERE ... IS NOT NULL)
 * seguindo o padrão já usado em hunter_candidates.consentToken (B3).
 */
export class B2B7ResetInviteTokens1749000000000 implements MigrationInterface {
  name = 'B2B7ResetInviteTokens1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── B2 — reset de senha ─────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_passwordResetToken"
        ON "users" ("passwordResetToken")
        WHERE "passwordResetToken" IS NOT NULL
    `);

    // ── B7 — convite de time por token ──────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "team_members"
        ADD COLUMN IF NOT EXISTS "inviteToken" VARCHAR(64) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_team_members_inviteToken"
        ON "team_members" ("inviteToken")
        WHERE "inviteToken" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_team_members_inviteToken"`,
    );
    await queryRunner.query(`
      ALTER TABLE "team_members" DROP COLUMN IF EXISTS "inviteToken"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_passwordResetToken"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "passwordResetExpiresAt",
        DROP COLUMN IF EXISTS "passwordResetToken"
    `);
  }
}
