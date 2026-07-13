import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A5 (painel admin — Cupons de campanha, §A). O schema de `coupons` só
 * cobria o cupom de referral automático (code/discountType/discountValue/
 * isActive) — o CRUD de campanha do spec pede validade e limite de usos,
 * que não existiam. `usageCount` é incrementado em `createRedemption()`
 * (coupons.service.ts) pra permitir aplicar o `usageLimit` no `validate()`.
 */
export class A5CouponCampaigns1750100000000 implements MigrationInterface {
  name = 'A5CouponCampaigns1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupons"
      ADD COLUMN IF NOT EXISTS "validFrom" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "validUntil" timestamp NULL,
      ADD COLUMN IF NOT EXISTS "usageLimit" integer NULL,
      ADD COLUMN IF NOT EXISTS "usageCount" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupons"
      DROP COLUMN IF EXISTS "validFrom",
      DROP COLUMN IF EXISTS "validUntil",
      DROP COLUMN IF EXISTS "usageLimit",
      DROP COLUMN IF EXISTS "usageCount"
    `);
  }
}
