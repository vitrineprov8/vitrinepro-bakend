import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B4 — Marketplace/fee na vaga.
 *
 * Adiciona:
 *  - vagas.feePercent / feeAmount: valor do fee pago ao hunter na contratação
 *    (percent sobre o salário e/ou valor fixo em R$ — a UI usa o que estiver
 *    preenchido; ambos nullable, mas ao menos um é exigido quando allowHunters=true,
 *    validado em VagasService, não no banco).
 *  - vagas.maxHunters: nº máximo de hunters com interesse ACEITO simultâneo
 *    nesta vaga (default 5, RN da spec "hunters: 3/5").
 *  - vagas.exclusivityDays: janela de exclusividade de indicação em dias
 *    (default 90 — mesma janela hoje hardcoded em HunterCandidatesService
 *    como RN-NOVA-02; passa a vir da vaga em vez de constante fixa).
 *  - hunter_interests.termsAcceptedAt: timestamp de aceite dos termos de
 *    intermediação pelo hunter ao expressar interesse (T-H07).
 *  - users.hunterContactRevealStageOrder: preferência da empresa/recrutador
 *    de em qual etapa (order da pipeline_template) o contato do candidato
 *    submetido por hunter deixa de ser mascarado (RN-NOVA-03). Default 2
 *    (3ª coluna — "abordados" no template padrão), conforme design-spec 05.
 */
export class B4MarketplaceFee1749200000000 implements MigrationInterface {
  name = 'B4MarketplaceFee1749200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vagas" ADD COLUMN IF NOT EXISTS "feePercent" numeric(5,2) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" ADD COLUMN IF NOT EXISTS "feeAmount" numeric(12,2) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" ADD COLUMN IF NOT EXISTS "maxHunters" integer NOT NULL DEFAULT 5
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" ADD COLUMN IF NOT EXISTS "exclusivityDays" integer NOT NULL DEFAULT 90
    `);
    await queryRunner.query(`
      ALTER TABLE "hunter_interests" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hunterContactRevealStageOrder" integer NOT NULL DEFAULT 2
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "hunterContactRevealStageOrder"
    `);
    await queryRunner.query(`
      ALTER TABLE "hunter_interests" DROP COLUMN IF EXISTS "termsAcceptedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" DROP COLUMN IF EXISTS "exclusivityDays"
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" DROP COLUMN IF EXISTS "maxHunters"
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" DROP COLUMN IF EXISTS "feeAmount"
    `);
    await queryRunner.query(`
      ALTER TABLE "vagas" DROP COLUMN IF EXISTS "feePercent"
    `);
  }
}
