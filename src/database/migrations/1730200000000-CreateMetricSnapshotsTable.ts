import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetricSnapshotsTable1730200000000 implements MigrationInterface {
  name = 'CreateMetricSnapshotsTable1730200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "metric_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "session_id" character varying(128) NOT NULL,
        "lab_slug" character varying(128),
        "track_slug" character varying(64),
        "run_type" character varying(32) NOT NULL,
        "dataset_family" character varying(64) NOT NULL,
        "dataset_tier" character varying(16) NOT NULL,
        "dataset_version" character varying(32) NOT NULL,
        "metrics" jsonb NOT NULL,
        "omitted_metric_keys" jsonb,
        "request_id" character varying(128),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_metric_snapshots" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_metric_snapshots_session_lab_created"
      ON "metric_snapshots" ("session_id", "lab_slug", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_metric_snapshots_session_lab_created"
    `);
    await queryRunner.query(`DROP TABLE "metric_snapshots"`);
  }
}
