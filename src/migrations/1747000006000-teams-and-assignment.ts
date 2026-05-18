import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: teams + team_members tables + vagas.assigned_to_id FK
 *
 * Creates multi-user team support for TEAM and ENTERPRISE plans.
 * Adds `assigned_to_id` to `vagas` to track the responsible recruiter.
 */
export class TeamsAndAssignment1747000006000 implements MigrationInterface {
  name = 'TeamsAndAssignment1747000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── enums ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "team_role_enum" AS ENUM ('OWNER', 'MANAGER', 'RECRUITER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "team_member_status_enum" AS ENUM ('PENDING', 'ACTIVE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── teams table ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id"        UUID          NOT NULL DEFAULT uuid_generate_v4(),
        "name"      VARCHAR(255)  NOT NULL,
        "ownerId"   UUID          NOT NULL UNIQUE,
        "createdAt" TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_owner"
          FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_teams_ownerId" ON "teams" ("ownerId")
    `);

    // ── team_members table ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id"           UUID                      NOT NULL DEFAULT uuid_generate_v4(),
        "teamId"       UUID                      NOT NULL,
        "userId"       UUID,
        "invitedEmail" VARCHAR(255),
        "role"         "team_role_enum"           NOT NULL DEFAULT 'RECRUITER',
        "status"       "team_member_status_enum"  NOT NULL DEFAULT 'PENDING',
        "joinedAt"     TIMESTAMP                 NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_members_team_user" UNIQUE ("teamId", "userId"),
        CONSTRAINT "FK_team_members_team"
          FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_members_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_team_members_teamId" ON "team_members" ("teamId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_team_members_userId" ON "team_members" ("userId")
    `);

    // ── vagas.assigned_to_id FK ───────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "vagas"
        ADD COLUMN IF NOT EXISTS "assignedToId" UUID,
        ADD CONSTRAINT "FK_vagas_assigned_to"
          FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // vagas FK
    await queryRunner.query(`
      ALTER TABLE "vagas"
        DROP CONSTRAINT IF EXISTS "FK_vagas_assigned_to",
        DROP COLUMN IF EXISTS "assignedToId"
    `);

    // team_members
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_members_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_members_teamId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members"`);

    // teams
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_teams_ownerId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);

    // enums
    await queryRunner.query(`DROP TYPE IF EXISTS "team_member_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "team_role_enum"`);
  }
}
