import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: rename-plan-tiers
 *
 *   PERSONAL    → RECRUITER
 *   HUNTER      → TEAM
 *   EMPRESARIAL → ENTERPRISE
 *
 * Two enum types may exist (TypeORM auto-creates one per table when @Column
 * does not pass `enumName`): users_plan_enum and subscriptions_plan_enum.
 *
 * Strategy: cast both `plan` columns to TEXT, rewrite the values, drop both
 * old enum types, recreate them clean with only the new 4 values, and cast
 * the columns back. This is robust to either schema (shared enum or split)
 * and idempotent on re-run.
 */
export class RenamePlanTiers1747000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop default on users.plan so we can change its type
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
    `);

    // 2. Convert both columns to TEXT temporarily (works for any enum type)
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;
    `);

    // 3. Rewrite legacy values
    await queryRunner.query(`
      UPDATE "users"
      SET "plan" = CASE "plan"
        WHEN 'PERSONAL'    THEN 'RECRUITER'
        WHEN 'HUNTER'      THEN 'TEAM'
        WHEN 'EMPRESARIAL' THEN 'ENTERPRISE'
        ELSE "plan"
      END
      WHERE "plan" IN ('PERSONAL', 'HUNTER', 'EMPRESARIAL');
    `);

    await queryRunner.query(`
      UPDATE "subscriptions"
      SET "plan" = CASE "plan"
        WHEN 'PERSONAL'    THEN 'RECRUITER'
        WHEN 'HUNTER'      THEN 'TEAM'
        WHEN 'EMPRESARIAL' THEN 'ENTERPRISE'
        ELSE "plan"
      END
      WHERE "plan" IN ('PERSONAL', 'HUNTER', 'EMPRESARIAL');
    `);

    // 4. Drop the old enum types (no column references them now)
    await queryRunner.query(`DROP TYPE IF EXISTS users_plan_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS subscriptions_plan_enum;`);

    // 5. Recreate both enum types clean, matching TypeORM's per-column naming
    await queryRunner.query(`
      CREATE TYPE users_plan_enum AS ENUM ('FREE', 'RECRUITER', 'TEAM', 'ENTERPRISE');
    `);

    await queryRunner.query(`
      CREATE TYPE subscriptions_plan_enum AS ENUM ('FREE', 'RECRUITER', 'TEAM', 'ENTERPRISE');
    `);

    // 6. Cast columns back to their respective enum types
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "plan" TYPE users_plan_enum USING "plan"::users_plan_enum;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "plan" SET DEFAULT 'FREE';
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ALTER COLUMN "plan" TYPE subscriptions_plan_enum USING "plan"::subscriptions_plan_enum;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: rename new values back to the legacy names.
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ALTER COLUMN "plan" TYPE TEXT USING "plan"::text;
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "plan" = CASE "plan"
        WHEN 'RECRUITER'  THEN 'PERSONAL'
        WHEN 'TEAM'       THEN 'HUNTER'
        WHEN 'ENTERPRISE' THEN 'EMPRESARIAL'
        ELSE "plan"
      END
      WHERE "plan" IN ('RECRUITER', 'TEAM', 'ENTERPRISE');
    `);

    await queryRunner.query(`
      UPDATE "subscriptions"
      SET "plan" = CASE "plan"
        WHEN 'RECRUITER'  THEN 'PERSONAL'
        WHEN 'TEAM'       THEN 'HUNTER'
        WHEN 'ENTERPRISE' THEN 'EMPRESARIAL'
        ELSE "plan"
      END
      WHERE "plan" IN ('RECRUITER', 'TEAM', 'ENTERPRISE');
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS users_plan_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS subscriptions_plan_enum;`);

    await queryRunner.query(`
      CREATE TYPE users_plan_enum AS ENUM ('FREE', 'PERSONAL', 'HUNTER', 'EMPRESARIAL');
    `);

    await queryRunner.query(`
      CREATE TYPE subscriptions_plan_enum AS ENUM ('FREE', 'PERSONAL', 'HUNTER', 'EMPRESARIAL');
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "plan" TYPE users_plan_enum USING "plan"::users_plan_enum;
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "plan" SET DEFAULT 'FREE';
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ALTER COLUMN "plan" TYPE subscriptions_plan_enum USING "plan"::subscriptions_plan_enum;
    `);
  }
}
