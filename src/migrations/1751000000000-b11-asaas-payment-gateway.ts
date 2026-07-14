import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B11 — gateway de pagamento real (Asaas), substitui o mock de
 * subscriptions.confirm(). `users`: customer + dados de cobrança
 * cacheados pra reuso entre assinaturas. `subscriptions`: correlação com
 * a cobrança na Asaas (billingType/asaasPaymentId/invoiceUrl/dueDate) —
 * asaasPaymentId é a chave usada pelo webhook pra achar a assinatura.
 */
export class B11AsaasPaymentGateway1751000000000 implements MigrationInterface {
  name = 'B11AsaasPaymentGateway1751000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "asaasCustomerId" varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS "cpfCnpj" varchar(20) NULL,
      ADD COLUMN IF NOT EXISTS "billingPostalCode" varchar(9) NULL,
      ADD COLUMN IF NOT EXISTS "billingAddressNumber" varchar(20) NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscriptions_billingtype_enum" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      ADD COLUMN IF NOT EXISTS "billingType" "subscriptions_billingtype_enum" NULL,
      ADD COLUMN IF NOT EXISTS "asaasPaymentId" varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS "invoiceUrl" varchar(500) NULL,
      ADD COLUMN IF NOT EXISTS "dueDate" timestamp NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_asaasPaymentId" ON "subscriptions" ("asaasPaymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscriptions_asaasPaymentId"`);
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN IF EXISTS "billingType",
      DROP COLUMN IF EXISTS "asaasPaymentId",
      DROP COLUMN IF EXISTS "invoiceUrl",
      DROP COLUMN IF EXISTS "dueDate"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscriptions_billingtype_enum"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "asaasCustomerId",
      DROP COLUMN IF EXISTS "cpfCnpj",
      DROP COLUMN IF EXISTS "billingPostalCode",
      DROP COLUMN IF EXISTS "billingAddressNumber"
    `);
  }
}
