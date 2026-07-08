import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitTracksTable1730100000000 implements MigrationInterface {
  name = 'InitTracksTable1730100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tracks_status_enum" AS ENUM ('active', 'coming-soon')
    `);

    await queryRunner.query(`
      CREATE TYPE "tracks_runtime_adapter_type_enum" AS ENUM (
        'playground_postgresql',
        'playground_redis',
        'headless_react_sandbox',
        'simulation_engine'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "tracks_input_surface_type_enum" AS ENUM (
        'sql_editor',
        'command_panel',
        'component_sandbox',
        'config_form'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(64) NOT NULL,
        "name" character varying(120) NOT NULL,
        "description" text NOT NULL,
        "status" "tracks_status_enum" NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "runtime_adapter_type" "tracks_runtime_adapter_type_enum" NOT NULL,
        "input_surface_type" "tracks_input_surface_type_enum" NOT NULL,
        "metric_catalog_id" character varying(64) NOT NULL,
        "visualization_kit_id" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tracks_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_tracks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tracks_display_order" ON "tracks" ("display_order")
    `);

    await queryRunner.query(`
      INSERT INTO "tracks" (
        "slug",
        "name",
        "description",
        "status",
        "display_order",
        "runtime_adapter_type",
        "input_surface_type",
        "metric_catalog_id",
        "visualization_kit_id"
      ) VALUES
      (
        'database-sql',
        'Database / SQL',
        'Learn indexes, query plans, pagination, and transactions through hands-on SQL experiments.',
        'active',
        1,
        'playground_postgresql',
        'sql_editor',
        'database-metrics',
        'database-viz'
      ),
      (
        'caching-concurrency',
        'Caching & Concurrency',
        'Explore Redis caching patterns, transactions, isolation, and deadlocks.',
        'coming-soon',
        2,
        'playground_redis',
        'command_panel',
        'redis-metrics',
        'redis-viz'
      ),
      (
        'frontend-performance',
        'Frontend Performance',
        'Understand React rendering, browser paint, bundle size, and network optimization.',
        'coming-soon',
        3,
        'headless_react_sandbox',
        'component_sandbox',
        'react-metrics',
        'react-viz'
      )
      ON CONFLICT ("slug") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tracks"`);
    await queryRunner.query(`DROP TYPE "tracks_input_surface_type_enum"`);
    await queryRunner.query(`DROP TYPE "tracks_runtime_adapter_type_enum"`);
    await queryRunner.query(`DROP TYPE "tracks_status_enum"`);
  }
}
