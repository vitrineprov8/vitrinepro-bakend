import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B23 — audit log genérico de ações admin (admin_audit_logs).
 */
export class B23AdminAuditLog1749800000000 implements MigrationInterface {
  name = 'B23AdminAuditLog1749800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "adminId" uuid NOT NULL,
        "action" varchar(64) NOT NULL,
        "targetType" varchar(64) NOT NULL,
        "targetId" varchar(64) NOT NULL,
        "reason" text NULL,
        "payloadBefore" jsonb NULL,
        "payloadAfter" jsonb NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_adminId" ON "admin_audit_logs" ("adminId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_action" ON "admin_audit_logs" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_target" ON "admin_audit_logs" ("targetType", "targetId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
  }
}
