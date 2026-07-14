import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B25 — pagamento da comissão do hunter (fee share). Decisão arquitetural
 * (pedido explícito do Andres, 2026-07-14): aprovação MANUAL de um admin +
 * execução AUTOMÁTICA do sistema via Asaas Transfers assim que aprovado.
 *
 * `users`: dados de recebimento (Pix + CPF/CNPJ + tipo pessoa) configurados
 * pelo hunter em `/app/hunter/ganhos` (Extrato > "Configurar recebimento").
 * `payouts`: um registro por Placement com hunterShareAmount, criado quando
 * o Placement vira FEE_RELEASED — snapshot dos dados de recebimento no
 * momento da criação (auditoria) + pipeline de revisão/execução.
 */
export class B25HunterPayouts1752000000000 implements MigrationInterface {
  name = 'B25HunterPayouts1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "payoutPixKey" varchar(140) NULL,
      ADD COLUMN IF NOT EXISTS "payoutPixKeyType" varchar(16) NULL,
      ADD COLUMN IF NOT EXISTS "payoutLegalType" varchar(8) NULL,
      ADD COLUMN IF NOT EXISTS "payoutCpfCnpj" varchar(20) NULL,
      ADD COLUMN IF NOT EXISTS "payoutConfiguredAt" timestamp NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payouts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "placementId" uuid NOT NULL,
        "hunterId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING_REVIEW',
        "pixKeySnapshot" varchar(140) NULL,
        "pixKeyTypeSnapshot" varchar(16) NULL,
        "legalTypeSnapshot" varchar(8) NULL,
        "cpfCnpjSnapshot" varchar(20) NULL,
        "nfUrl" varchar(500) NULL,
        "nfKey" varchar(500) NULL,
        "reviewedByAdminId" uuid NULL,
        "reviewedAt" timestamp NULL,
        "rejectionReason" text NULL,
        "asaasTransferId" varchar(64) NULL,
        "processedAt" timestamp NULL,
        "paidAt" timestamp NULL,
        "failureReason" text NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payouts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payouts_placementId" FOREIGN KEY ("placementId") REFERENCES "placements"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payouts_hunterId" FOREIGN KEY ("hunterId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payouts_placementId" ON "payouts" ("placementId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payouts_hunterId" ON "payouts" ("hunterId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payouts_status" ON "payouts" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payouts"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "payoutPixKey",
      DROP COLUMN IF EXISTS "payoutPixKeyType",
      DROP COLUMN IF EXISTS "payoutLegalType",
      DROP COLUMN IF EXISTS "payoutCpfCnpj",
      DROP COLUMN IF EXISTS "payoutConfiguredAt"
    `);
  }
}
