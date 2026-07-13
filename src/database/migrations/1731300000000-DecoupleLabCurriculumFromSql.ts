import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Decouples lab curriculum from Database/SQL specifics so any Track (React,
 * Redis, Kafka, Docker, …) can own a curriculum without SQL columns.
 *
 * - `recommended_query` and `dataset` become nullable (Database/SQL-only).
 * - New `config` jsonb holds optional per-track lab-level metadata.
 * - Backfill nulls out the placeholder query/dataset previously seeded for
 *   non-PostgreSQL tracks (e.g. the Frontend React labs).
 */
export class DecoupleLabCurriculumFromSql1731300000000
  implements MigrationInterface
{
  name = 'DecoupleLabCurriculumFromSql1731300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lab_summary_curricula" ALTER COLUMN "recommended_query" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_summary_curricula" ALTER COLUMN "dataset" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_summary_curricula" ADD COLUMN IF NOT EXISTS "config" jsonb`,
    );

    // Remove SQL/dataset placeholders for non-PostgreSQL tracks.
    await queryRunner.query(`
      UPDATE "lab_summary_curricula" c
      SET "recommended_query" = NULL, "dataset" = NULL, "updated_at" = now()
      FROM "labs" l
      JOIN "tracks" t ON t.id = l.track_id
      WHERE c.lab_id = l.id
        AND t.runtime_adapter_type <> 'playground_postgresql'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore placeholders so NOT NULL can be re-applied.
    const emptyQuery = JSON.stringify({
      sql: '',
      exampleParameters: [],
      paramHints: [],
      description: '',
    });
    const noDataset = JSON.stringify({
      family: 'none',
      version: 'v1',
      recommendedTier: [],
    });

    await queryRunner.query(
      `UPDATE "lab_summary_curricula" SET "recommended_query" = $1::jsonb WHERE "recommended_query" IS NULL`,
      [emptyQuery],
    );
    await queryRunner.query(
      `UPDATE "lab_summary_curricula" SET "dataset" = $1::jsonb WHERE "dataset" IS NULL`,
      [noDataset],
    );

    await queryRunner.query(
      `ALTER TABLE "lab_summary_curricula" DROP COLUMN IF EXISTS "config"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_summary_curricula" ALTER COLUMN "dataset" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_summary_curricula" ALTER COLUMN "recommended_query" SET NOT NULL`,
    );
  }
}
