import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates lab flow tables and seeds Index Playground curriculum + steps once.
 * Skip seed when curriculum or any guided steps already exist for index-playground.
 */
export class CreateLabFlowTablesAndSeedIndexPlayground1730800000000
  implements MigrationInterface
{
  name = 'CreateLabFlowTablesAndSeedIndexPlayground1730800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lab_summary_curricula" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lab_id" uuid NOT NULL,
        "learning_goal" text NOT NULL,
        "theory" text NOT NULL,
        "recommended_query" jsonb NOT NULL,
        "recommended_create_index_sql" text,
        "recommended_drop_index_sql" text,
        "dataset" jsonb NOT NULL,
        "quiz_required" boolean NOT NULL DEFAULT false,
        "optional_benchmark_note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lab_summary_curricula" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lab_summary_curricula_lab_id" UNIQUE ("lab_id"),
        CONSTRAINT "FK_lab_summary_curricula_lab"
          FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lab_guided_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lab_id" uuid NOT NULL,
        "display_order" int NOT NULL,
        "title" varchar(200) NOT NULL,
        "instruction" text NOT NULL,
        "action" varchar(64) NOT NULL,
        "payload" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lab_guided_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lab_guided_steps_lab"
          FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lab_guided_steps_lab_id" ON "lab_guided_steps" ("lab_id")
    `);

    const labs: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM labs WHERE slug = $1 LIMIT 1`,
      ['index-playground'],
    );

    if (labs.length === 0) {
      throw new Error(
        'Lab "index-playground" not found; run prior catalog seeds before lab-flow migration',
      );
    }

    const labId = labs[0].id as string;

    const existingCurriculum: Array<{ cnt: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS cnt FROM lab_summary_curricula WHERE lab_id = $1`,
      [labId],
    );
    const existingSteps: Array<{ cnt: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS cnt FROM lab_guided_steps WHERE lab_id = $1`,
      [labId],
    );

    const hasCurriculum = Number(existingCurriculum[0]?.cnt ?? 0) > 0;
    const hasSteps = Number(existingSteps[0]?.cnt ?? 0) > 0;
    if (hasCurriculum || hasSteps) {
      return;
    }

    const recommendedQuery = {
      sql: 'SELECT id, email, name FROM users WHERE email = $1',
      exampleParameters: ['user1@example.com'],
      paramHints: [
        'Pass parameters: ["user1@example.com"] (or any email that exists in the commerce seed). Do not run with an empty parameters array.',
      ],
      description:
        'Selective equality lookup on users.email (unindexed in baseline schema) to demonstrate seq scan vs index scan.',
    };

    const dataset = {
      family: 'commerce',
      version: 'v1',
      recommendedTier: ['100k', '1m'],
    };

    await queryRunner.query(
      `
      INSERT INTO lab_summary_curricula (
        lab_id,
        learning_goal,
        theory,
        recommended_query,
        recommended_create_index_sql,
        recommended_drop_index_sql,
        dataset,
        quiz_required,
        optional_benchmark_note
      ) VALUES (
        $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9
      )
      `,
      [
        labId,
        'Understand how a B-Tree index changes lookup plans: sequential scan vs index scan, and why rows scanned drop for selective equality filters.',
        'Without a useful index, PostgreSQL often reads many rows (sequential scan) to find a few matches. A B-Tree index on the filter column lets the planner use an Index Scan, touching far fewer rows. In this lab, compare EXPLAIN metrics (rows_scanned, seq_scan_used, index_scan_used) before and after creating an index on users.email. Completing the lab requires passing the quiz.',
        JSON.stringify(recommendedQuery),
        'CREATE INDEX idx_users_email ON users (email)',
        'DROP INDEX idx_users_email',
        JSON.stringify(dataset),
        true,
        'Optional: enqueue the guided SELECT via existing Benchmark Runner (POST benchmark enqueue) before and after the index to compare latency. No Index Playground-specific benchmark API.',
      ],
    );

    const steps: Array<{
      order: number;
      title: string;
      instruction: string;
      action: string;
      payload: Record<string, unknown> | null;
    }> = [
      {
        order: 1,
        title: 'Run the guided lookup (no index)',
        instruction:
          'Prepare the commerce dataset, then run the recommended SELECT via Experiment Runner. Note execution time; scan type comes from Explain next.',
        action: 'run_sql',
        payload: { recommendedQuery },
      },
      {
        order: 2,
        title: 'Explain before the index',
        instruction:
          'Run EXPLAIN (or EXPLAIN ANALYZE) on the same query. Expect seq_scan_used=1 and high rows_scanned. Do not infer scan type from plain SQL run metrics alone.',
        action: 'run_explain_analyze',
        payload: { recommendedQuery },
      },
      {
        order: 3,
        title: 'Create the B-Tree index',
        instruction:
          'Submit the recommended CREATE INDEX SQL via Experiment Runner (sandbox allowlist). No separate create-index API.',
        action: 'create_index_sql',
        payload: { sql: 'CREATE INDEX idx_users_email ON users (email)' },
      },
      {
        order: 4,
        title: 'Run the lookup again',
        instruction:
          'Re-run the recommended SELECT. Execution time should drop when the planner uses the new index.',
        action: 'run_sql',
        payload: { recommendedQuery },
      },
      {
        order: 5,
        title: 'Explain after the index',
        instruction:
          'Run EXPLAIN again. Expect index_scan_used=1 and much lower rows_scanned. Compare Metric Contract keys with the before snapshot.',
        action: 'run_explain_analyze',
        payload: { recommendedQuery },
      },
      {
        order: 6,
        title: 'Compare metrics',
        instruction:
          'Use Metrics Pipeline history (or explain responses) for before/after: rows_scanned, seq_scan_used, index_scan_used.',
        action: 'compare_metrics',
        payload: null,
      },
      {
        order: 7,
        title: 'Optional: drop index and re-check',
        instruction:
          'Submit the recommended DROP INDEX SQL, then explain again to see sequential scan return.',
        action: 'drop_index_sql',
        payload: { sql: 'DROP INDEX idx_users_email' },
      },
      {
        order: 8,
        title: 'Optional: light benchmark',
        instruction:
          'Optionally enqueue the guided query via the existing Benchmark Runner APIs (no Index-specific benchmark endpoint).',
        action: 'optional_benchmark',
        payload: null,
      },
      {
        order: 9,
        title: 'Take the quiz',
        instruction:
          'Pass the Index Playground quiz (100% correct) to mark the lab complete. Progress self-complete is quiz-gated.',
        action: 'take_quiz',
        payload: null,
      },
    ];

    for (const step of steps) {
      await queryRunner.query(
        `
        INSERT INTO lab_guided_steps (
          lab_id, display_order, title, instruction, action, payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [
          labId,
          step.order,
          step.title,
          step.instruction,
          step.action,
          step.payload === null ? null : JSON.stringify(step.payload),
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_guided_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_summary_curricula"`);
  }
}
