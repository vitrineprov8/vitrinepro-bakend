import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Faturas de fee" — cobrança real (Asaas) da empresa pelo fee do placement
 * (spec `design-spec/05_WORKSPACE_EMPRESA.md §T-E07`). Gera 1 fatura por
 * placement hunter-sourced (índice único em placementId) quando marcado
 * HIRED. `type` pronto para SUBSCRIPTION/BOOST (não emitidos por aqui hoje).
 */
export class InvoicesFee1752100000000 implements MigrationInterface {
  name = 'InvoicesFee1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "companyId" uuid NOT NULL,
        "placementId" uuid NULL,
        "type" varchar(16) NOT NULL DEFAULT 'FEE',
        "amount" numeric(12,2) NOT NULL,
        "dueDate" timestamp NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "billingType" varchar(20) NULL,
        "asaasPaymentId" varchar(64) NULL,
        "invoiceUrl" varchar(500) NULL,
        "paidAt" timestamp NULL,
        "disputeReason" text NULL,
        "disputedAt" timestamp NULL,
        "disputeResolvedAt" timestamp NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoices_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoices_companyId" FOREIGN KEY ("companyId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_invoices_placementId" FOREIGN KEY ("placementId") REFERENCES "placements"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoices_placementId" ON "invoices" ("placementId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_companyId" ON "invoices" ("companyId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_status" ON "invoices" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_invoices_asaasPaymentId" ON "invoices" ("asaasPaymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
  }
}
