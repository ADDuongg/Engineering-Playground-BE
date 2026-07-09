import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuizTablesAndSeed1730500000000
  implements MigrationInterface
{
  name = 'CreateQuizTablesAndSeed1730500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quizzes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lab_id" uuid NOT NULL,
        "title" character varying(200),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_quizzes_lab_id" UNIQUE ("lab_id"),
        CONSTRAINT "PK_quizzes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quizzes_lab_id" FOREIGN KEY ("lab_id")
          REFERENCES "labs"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quiz_id" uuid NOT NULL,
        "prompt" text NOT NULL,
        "question_type" character varying(32) NOT NULL,
        "sequence_order" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_questions_quiz_id" FOREIGN KEY ("quiz_id")
          REFERENCES "quizzes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_questions_quiz_id_sequence_order"
      ON "quiz_questions" ("quiz_id", "sequence_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_options" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "question_id" uuid NOT NULL,
        "label" text NOT NULL,
        "sequence_order" integer NOT NULL,
        "is_correct" boolean NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_options" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_options_question_id" FOREIGN KEY ("question_id")
          REFERENCES "quiz_questions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_options_question_id_sequence_order"
      ON "quiz_options" ("question_id", "sequence_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quiz_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "quiz_id" uuid NOT NULL,
        "correct_count" integer NOT NULL,
        "total_questions" integer NOT NULL,
        "percent_correct" integer NOT NULL,
        "passed" boolean NOT NULL,
        "answers_json" jsonb NOT NULL,
        "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_attempts_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quiz_attempts_quiz_id" FOREIGN KEY ("quiz_id")
          REFERENCES "quizzes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_quiz_attempts_user_quiz_attempted"
      ON "quiz_attempts" ("user_id", "quiz_id", "attempted_at" DESC)
    `);

    // Seed quiz for index-playground with stable UUIDs for test fixtures
    await queryRunner.query(`
      INSERT INTO "quizzes" ("id", "lab_id", "title")
      SELECT
        'a1000000-0000-4000-8000-000000000001'::uuid,
        l.id,
        'Index Playground Quiz'
      FROM "labs" l
      WHERE l.slug = 'index-playground'
      ON CONFLICT ("lab_id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "quiz_questions" ("id", "quiz_id", "prompt", "question_type", "sequence_order")
      VALUES
        (
          'a1000000-0000-4000-8000-000000000011'::uuid,
          'a1000000-0000-4000-8000-000000000001'::uuid,
          'What does a B-Tree index primarily help the database avoid for equality lookups?',
          'single_select',
          1
        ),
        (
          'a1000000-0000-4000-8000-000000000012'::uuid,
          'a1000000-0000-4000-8000-000000000001'::uuid,
          'Which EXPLAIN plan node typically indicates an index was used for a filter?',
          'single_select',
          2
        )
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "quiz_options" ("id", "question_id", "label", "sequence_order", "is_correct")
      VALUES
        (
          'a1000000-0000-4000-8000-000000000021'::uuid,
          'a1000000-0000-4000-8000-000000000011'::uuid,
          'A full sequential scan of the table',
          1,
          true
        ),
        (
          'a1000000-0000-4000-8000-000000000022'::uuid,
          'a1000000-0000-4000-8000-000000000011'::uuid,
          'Writing WAL records',
          2,
          false
        ),
        (
          'a1000000-0000-4000-8000-000000000023'::uuid,
          'a1000000-0000-4000-8000-000000000011'::uuid,
          'Creating foreign keys',
          3,
          false
        ),
        (
          'a1000000-0000-4000-8000-000000000031'::uuid,
          'a1000000-0000-4000-8000-000000000012'::uuid,
          'Index Scan / Index Only Scan',
          1,
          true
        ),
        (
          'a1000000-0000-4000-8000-000000000032'::uuid,
          'a1000000-0000-4000-8000-000000000012'::uuid,
          'Seq Scan',
          2,
          false
        ),
        (
          'a1000000-0000-4000-8000-000000000033'::uuid,
          'a1000000-0000-4000-8000-000000000012'::uuid,
          'HashAggregate',
          3,
          false
        )
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quiz_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quizzes"`);
  }
}
