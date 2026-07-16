import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B26 — "Sessões ativas com revogar" (design-spec §C) + suporte a exclusão
 * self-service de conta (LGPD). Tabela nova `user_sessions`: 1 linha por
 * login, cujo `id` é usado como `jti` no JWT (ver `AuthService.createSession`
 * / `JwtStrategy.validate`).
 */
export class B26UserSessions1752200000000 implements MigrationInterface {
  name = 'B26UserSessions1752200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "userAgent" varchar(500) NULL,
        "ip" varchar(64) NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "lastSeenAt" timestamp NULL,
        "revokedAt" timestamp NULL,
        CONSTRAINT "PK_user_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_sessions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_userId" ON "user_sessions" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);
  }
}
