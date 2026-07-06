import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B9 — Placements. Spec: `design-spec/06_ADMIN_E_FLUXOS_TRANSVERSAIS.md §P`.
 *
 * Nova tabela `placements`, 1:1 com `vaga_applications` (índice único em
 * applicationId). Fee/hunterShare/platformShare/garantia só existem quando
 * `hunterId` não é nulo (candidato veio de indicação de hunter). Split do
 * fee: 75% hunter / 25% plataforma (calculado em app, não em SQL). Garantia
 * fixa de 90 dias a partir da confirmação (P2). Escopo confirmado com Andres:
 * quebra de garantia (P4) só gera reposição gratuita, sem fluxo de estorno.
 */
export class B9Placements1749600000000 implements MigrationInterface {
  name = 'B9Placements1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "placements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "applicationId" uuid NOT NULL,
        "vagaId" uuid NULL,
        "markedById" uuid NULL,
        "hunterId" uuid NULL,
        "finalSalary" numeric(12,2) NOT NULL,
        "regime" varchar(8) NULL,
        "startDate" date NULL,
        "feeAmount" numeric(12,2) NULL,
        "hunterShareAmount" numeric(12,2) NULL,
        "platformShareAmount" numeric(12,2) NULL,
        "termsAcceptedAt" timestamp NULL,
        "status" varchar(24) NOT NULL DEFAULT 'HIRED',
        "confirmedAt" timestamp NULL,
        "autoConfirmed" boolean NOT NULL DEFAULT false,
        "guaranteeEndsAt" timestamp NULL,
        "feeReleasedAt" timestamp NULL,
        "disputedAt" timestamp NULL,
        "disputeReason" text NULL,
        "disputeResolvedAt" timestamp NULL,
        "departureReportedAt" timestamp NULL,
        "departureDate" date NULL,
        "departureReason" varchar(255) NULL,
        "replacedByPlacementId" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_placements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_placements_application" FOREIGN KEY ("applicationId")
          REFERENCES "vaga_applications"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_placements_vaga" FOREIGN KEY ("vagaId")
          REFERENCES "vagas"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_placements_markedBy" FOREIGN KEY ("markedById")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_placements_hunter" FOREIGN KEY ("hunterId")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_placements_replacedBy" FOREIGN KEY ("replacedByPlacementId")
          REFERENCES "placements"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_placements_applicationId"
        ON "placements" ("applicationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_placements_hunterId"
        ON "placements" ("hunterId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_placements_status"
        ON "placements" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_placements_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_placements_hunterId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_placements_applicationId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "placements"`);
  }
}
