import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B3 — Submissão de candidatos por hunter (Workspace Hunter / T-H08)
 *
 * Changes:
 *   1. CREATE TABLE hunter_candidates — pool privado do hunter (candidato
 *      "fantasma" sem conta), com consentimento LGPD por token de e-mail.
 *   2. vaga_applications: torna userId NULLABLE e adiciona source /
 *      submittedByHunterId / hunterCandidateId. Substitui o UNIQUE(vagaId,userId)
 *      por dois índices únicos parciais (por candidato real e por fantasma).
 *
 * Regras: submissão exige consentStatus='GRANTED' e vaga.allowHunters;
 * limite N por hunter e trava de duplicidade 90d são aplicados no service.
 */
export class Phase2HunterCandidates1748600000000
  implements MigrationInterface
{
  name = 'Phase2HunterCandidates1748600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. hunter_candidates ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hunter_candidates" (
        "id"                UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "hunterId"          UUID         NOT NULL,
        "fullName"          VARCHAR(255) NOT NULL,
        "email"             VARCHAR(255) NOT NULL,
        "phone"             VARCHAR(50)  NULL,
        "linkedinUrl"       VARCHAR(500) NULL,
        "headline"          VARCHAR(255) NULL,
        "location"          VARCHAR(255) NULL,
        "cvUrl"             VARCHAR(500) NULL,
        "cvKey"             VARCHAR(500) NULL,
        "notes"             TEXT         NULL,
        "linkedUserId"      UUID         NULL,
        "consentStatus"     VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
        "consentToken"      VARCHAR(64)  NULL,
        "consentRequestedAt" TIMESTAMP   NULL,
        "consentDecidedAt"  TIMESTAMP    NULL,
        "createdAt"         TIMESTAMP    NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hunter_candidates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hunter_candidates_hunter"
          FOREIGN KEY ("hunterId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hunter_candidates_linkedUser"
          FOREIGN KEY ("linkedUserId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Um hunter não pode ter dois candidatos com o mesmo e-mail
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_hunter_candidates_hunter_email"
        ON "hunter_candidates" ("hunterId", lower("email"))
    `);

    // Lookup público do token de consentimento (hot-path)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hunter_candidates_consentToken"
        ON "hunter_candidates" ("consentToken")
        WHERE "consentToken" IS NOT NULL
    `);

    // ── 2. vaga_applications — origem/submissão por hunter ─────────────────────
    // source: DIRECT (candidato aplicou) | HUNTER (hunter submeteu)
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "source" VARCHAR(16) NOT NULL DEFAULT 'DIRECT'
    `);
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "submittedByHunterId" UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD COLUMN IF NOT EXISTS "hunterCandidateId" UUID NULL
    `);

    // Candidato fantasma não tem conta → userId passa a ser opcional
    await queryRunner.query(`
      ALTER TABLE "vaga_applications" ALTER COLUMN "userId" DROP NOT NULL
    `);

    // FKs das novas colunas
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD CONSTRAINT "FK_vaga_applications_submittedByHunter"
          FOREIGN KEY ("submittedByHunterId") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD CONSTRAINT "FK_vaga_applications_hunterCandidate"
          FOREIGN KEY ("hunterCandidateId") REFERENCES "hunter_candidates"("id") ON DELETE SET NULL
    `);

    // Substituir o UNIQUE(vagaId,userId) por índices únicos PARCIAIS:
    // um candidato real é único por vaga; um candidato fantasma é único por vaga.
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        DROP CONSTRAINT IF EXISTS "UQ_vaga_applications_vagaId_userId"
    `);
    // O nome real do constraint gerado pelo @Unique(['vagaId','userId']) pode
    // variar; remover por nome conhecido do TypeORM também.
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c FROM pg_constraint
          WHERE conrelid = '"vaga_applications"'::regclass AND contype = 'u'
            AND pg_get_constraintdef(oid) LIKE '%vagaId%userId%';
        IF c IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "vaga_applications" DROP CONSTRAINT %I', c);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vaga_applications_vaga_user"
        ON "vaga_applications" ("vagaId", "userId")
        WHERE "userId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vaga_applications_vaga_hunterCandidate"
        ON "vaga_applications" ("vagaId", "hunterCandidateId")
        WHERE "hunterCandidateId" IS NOT NULL
    `);
    // Consultas do dashboard do hunter: "meus candidatos submetidos"
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vaga_applications_submittedByHunter"
        ON "vaga_applications" ("submittedByHunterId")
        WHERE "submittedByHunterId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_vaga_applications_submittedByHunter"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_vaga_applications_vaga_hunterCandidate"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_vaga_applications_vaga_user"`,
    );
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        DROP CONSTRAINT IF EXISTS "FK_vaga_applications_hunterCandidate",
        DROP CONSTRAINT IF EXISTS "FK_vaga_applications_submittedByHunter"
    `);
    // Restaurar o UNIQUE original (pode falhar se houver fantasmas com userId null — ok em dev)
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        ADD CONSTRAINT "UQ_vaga_applications_vagaId_userId" UNIQUE ("vagaId", "userId")
    `);
    await queryRunner.query(`
      ALTER TABLE "vaga_applications"
        DROP COLUMN IF EXISTS "hunterCandidateId",
        DROP COLUMN IF EXISTS "submittedByHunterId",
        DROP COLUMN IF EXISTS "source"
    `);
    // Nota: userId volta a NOT NULL só se não houver linhas com null
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM "vaga_applications" WHERE "userId" IS NULL) THEN
          ALTER TABLE "vaga_applications" ALTER COLUMN "userId" SET NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_hunter_candidates_consentToken"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_hunter_candidates_hunter_email"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "hunter_candidates"`);
  }
}
