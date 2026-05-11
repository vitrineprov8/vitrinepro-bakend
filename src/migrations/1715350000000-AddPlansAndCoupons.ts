import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddPlansAndCoupons
 *
 * Adds plan subscription fields to users table, creates subscriptions/coupons/coupon_redemptions
 * tables, and backfills referral codes for all existing users.
 *
 * Safe to run on production — all new columns are nullable or have defaults.
 */
export class AddPlansAndCoupons1715350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------------
    // 1. Create enum types
    // ----------------------------------------------------------------
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_plan_enum AS ENUM ('FREE', 'PERSONAL', 'HUNTER', 'EMPRESARIAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE users_plan_status_enum AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'PENDING');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE subscription_status_enum AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE coupon_discount_type_enum AS ENUM ('PERCENT', 'FIXED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE coupon_redemption_status_enum AS ENUM ('PENDING_VALIDATION', 'VALIDATED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ----------------------------------------------------------------
    // 2. Add columns to users table
    // ----------------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "plan" users_plan_enum NOT NULL DEFAULT 'FREE',
        ADD COLUMN IF NOT EXISTS "plan_status" users_plan_status_enum NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS "plan_expires_at" TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS "referral_code" VARCHAR(16) UNIQUE NULL;
    `);

    // ----------------------------------------------------------------
    // 3. Backfill referral codes for existing users
    //    Uses MD5 of random UUID to generate unique 8-char uppercase codes.
    //    Loops to handle (extremely unlikely) collisions.
    // ----------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
        candidate VARCHAR(16);
        collision BOOLEAN;
      BEGIN
        FOR rec IN SELECT id FROM users WHERE referral_code IS NULL LOOP
          collision := TRUE;
          WHILE collision LOOP
            candidate := UPPER(SUBSTRING(MD5(GEN_RANDOM_UUID()::TEXT) FROM 1 FOR 8));
            SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = candidate) INTO collision;
          END LOOP;
          UPDATE users SET referral_code = candidate WHERE id = rec.id;
        END LOOP;
      END $$;
    `);

    // ----------------------------------------------------------------
    // 4. Create subscriptions table
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "plan" users_plan_enum NOT NULL,
        "status" subscription_status_enum NOT NULL DEFAULT 'PENDING',
        "priceBRL" NUMERIC(12, 2) NOT NULL,
        "couponCode" VARCHAR(32) NULL,
        "discountApplied" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        "startsAt" TIMESTAMP NULL,
        "endsAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_userId" ON "subscriptions" ("userId");
    `);

    // ----------------------------------------------------------------
    // 5. Create coupons table
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "code" VARCHAR(32) NOT NULL,
        "ownerId" UUID NULL,
        "discountType" coupon_discount_type_enum NOT NULL,
        "discountValue" NUMERIC(12, 2) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupons" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupons_code" UNIQUE ("code"),
        CONSTRAINT "FK_coupons_owner" FOREIGN KEY ("ownerId")
          REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_coupons_code" ON "coupons" ("code");
    `);

    // ----------------------------------------------------------------
    // 6. Create coupon_redemptions table
    // ----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "couponId" UUID NOT NULL,
        "redeemedById" UUID NULL,
        "subscriptionId" UUID NULL,
        "status" coupon_redemption_status_enum NOT NULL DEFAULT 'PENDING_VALIDATION',
        "validatedAt" TIMESTAMP NULL,
        "validatedById" UUID NULL,
        "bonusGranted" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupon_redemptions_coupon_redeemer" UNIQUE ("couponId", "redeemedById"),
        CONSTRAINT "FK_coupon_redemptions_coupon" FOREIGN KEY ("couponId")
          REFERENCES "coupons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_redemptions_redeemer" FOREIGN KEY ("redeemedById")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_coupon_redemptions_validator" FOREIGN KEY ("validatedById")
          REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "coupon_redemptions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions";`);

    // Remove columns from users
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "referral_code",
        DROP COLUMN IF EXISTS "plan_expires_at",
        DROP COLUMN IF EXISTS "plan_status",
        DROP COLUMN IF EXISTS "plan";
    `);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS coupon_redemption_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS coupon_discount_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS subscription_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS users_plan_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS users_plan_enum;`);
  }
}
