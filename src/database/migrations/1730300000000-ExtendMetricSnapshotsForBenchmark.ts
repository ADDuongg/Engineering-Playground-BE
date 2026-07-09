import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendMetricSnapshotsForBenchmark1730300000000
  implements MigrationInterface
{
  name = 'ExtendMetricSnapshotsForBenchmark1730300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "metric_snapshots"
      ADD COLUMN "job_id" character varying(128),
      ADD COLUMN "profile" jsonb
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_metric_snapshots_job_id"
      ON "metric_snapshots" ("job_id")
      WHERE "job_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."UQ_metric_snapshots_job_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "metric_snapshots"
      DROP COLUMN IF EXISTS "profile",
      DROP COLUMN IF EXISTS "job_id"
    `);
  }
}
