import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B1 — Persona/role de produto.
 *
 * Adiciona `users.personas` (lista de personas ativas: CANDIDATO, HUNTER,
 * EMPRESA). Backfill: contas `isCompany=true` recebem ['EMPRESA']; as demais
 * recebem ['CANDIDATO'] (toda conta não-empresa já tem perfil de profissional
 * hoje — o hunter é uma persona adicional ativada em cima dessa base).
 *
 * Armazenado como TEXT simples (TypeORM `simple-array`, valores separados por
 * vírgula) — mesmo padrão leve usado em `source`/`consentStatus` (B3), sem
 * criar um novo enum de banco para uma lista pequena e sujeita a crescer.
 */
export class B1UserPersonas1749100000000 implements MigrationInterface {
  name = 'B1UserPersonas1749100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "personas" TEXT NULL
    `);

    // Backfill: empresa → EMPRESA; demais → CANDIDATO.
    await queryRunner.query(`
      UPDATE "users" SET "personas" = 'EMPRESA' WHERE "isCompany" = true AND "personas" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "users" SET "personas" = 'CANDIDATO' WHERE "isCompany" = false AND "personas" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "personas"
    `);
  }
}
