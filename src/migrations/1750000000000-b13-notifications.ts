import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B13 — sino de notificações in-app + preferências por evento×canal.
 */
export class B13Notifications1750000000000 implements MigrationInterface {
  name = 'B13Notifications1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" varchar(32) NOT NULL,
        "title" varchar(255) NOT NULL,
        "message" text NOT NULL,
        "link" varchar(255) NULL,
        "metadata" jsonb NULL,
        "readAt" timestamp NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId" ON "notifications" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_readAt" ON "notifications" ("readAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" varchar(32) NOT NULL,
        "inAppEnabled" boolean NOT NULL DEFAULT true,
        "emailEnabled" boolean NOT NULL DEFAULT true,
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_preferences_user_type" ON "notification_preferences" ("userId", "type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_preferences_userId" ON "notification_preferences" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
