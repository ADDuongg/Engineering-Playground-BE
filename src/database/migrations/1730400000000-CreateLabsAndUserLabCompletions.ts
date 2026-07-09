import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLabsAndUserLabCompletions1730400000000
  implements MigrationInterface
{
  name = 'CreateLabsAndUserLabCompletions1730400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "labs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying(128) NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "track_id" uuid NOT NULL,
        "sequence_order" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_labs_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_labs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_labs_track_id" FOREIGN KEY ("track_id")
          REFERENCES "tracks"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_labs_track_id_sequence_order"
      ON "labs" ("track_id", "sequence_order")
    `);

    await queryRunner.query(`
      CREATE TABLE "user_lab_completions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "lab_id" uuid NOT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_lab_completions_user_lab" UNIQUE ("user_id", "lab_id"),
        CONSTRAINT "PK_user_lab_completions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_lab_completions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_lab_completions_lab_id" FOREIGN KEY ("lab_id")
          REFERENCES "labs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_lab_completions_user_id"
      ON "user_lab_completions" ("user_id")
    `);

    await queryRunner.query(`
      INSERT INTO "labs" ("slug", "title", "description", "track_id", "sequence_order")
      SELECT
        v.slug,
        v.title,
        v.description,
        t.id,
        v.sequence_order
      FROM (
        VALUES
          (
            'index-playground',
            'Index Playground',
            'Learn B-Tree index impact through before/after SQL experiments.',
            1
          ),
          (
            'explain-analyze',
            'Explain Analyze Lab',
            'Explore query planner behavior via execution plans.',
            2
          ),
          (
            'offset-vs-cursor',
            'Offset vs Cursor Lab',
            'Compare OFFSET and cursor pagination performance.',
            3
          ),
          (
            'benchmark-lab',
            'Benchmark Lab',
            'Measure throughput and latency under load.',
            4
          )
      ) AS v(slug, title, description, sequence_order)
      INNER JOIN "tracks" t ON t.slug = 'database-sql'
      ON CONFLICT ("slug") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_lab_completions"`);
    await queryRunner.query(`DROP TABLE "labs"`);
  }
}
