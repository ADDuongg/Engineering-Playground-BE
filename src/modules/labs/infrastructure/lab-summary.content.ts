import { LabGuidedStep, GuidedSql, LabSummaryDatasetHint } from '@db-play/types';

/**
 * In-repo curriculum for a lab summary (not persisted on Platform DB).
 * Merged with Lab/Track metadata in GetLabSummaryUseCase.
 */
export interface LabSummaryContent {
  learningGoal: string;
  theory: string;
  guidedSteps: LabGuidedStep[];
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
  /** Content-level hint; UseCase may also verify quiz existence */
  quizRequired: boolean;
  dataset: LabSummaryDatasetHint;
  optionalBenchmarkNote?: string | null;
}

export const INDEX_PLAYGROUND_SLUG = 'index-playground';

export const INDEX_PLAYGROUND_CONTENT: LabSummaryContent = {
  learningGoal:
    'Understand how a B-Tree index changes lookup plans: sequential scan vs index scan, and why rows scanned drop for selective equality filters.',
  theory:
    'Without a useful index, PostgreSQL often reads many rows (sequential scan) to find a few matches. A B-Tree index on the filter column lets the planner use an Index Scan, touching far fewer rows. In this lab, compare EXPLAIN metrics (rows_scanned, seq_scan_used, index_scan_used) before and after creating an index on users.email. Completing the lab requires passing the quiz.',
  guidedSteps: [
    {
      order: 1,
      title: 'Run the guided lookup (no index)',
      instruction:
        'Prepare the commerce dataset, then run the recommended SELECT via Experiment Runner. Note execution time; scan type comes from Explain next.',
      action: 'run_sql',
    },
    {
      order: 2,
      title: 'Explain before the index',
      instruction:
        'Run EXPLAIN (or EXPLAIN ANALYZE) on the same query. Expect seq_scan_used=1 and high rows_scanned. Do not infer scan type from plain SQL run metrics alone.',
      action: 'run_explain_analyze',
    },
    {
      order: 3,
      title: 'Create the B-Tree index',
      instruction:
        'Submit the recommended CREATE INDEX SQL via Experiment Runner (sandbox allowlist). No separate create-index API.',
      action: 'create_index_sql',
    },
    {
      order: 4,
      title: 'Run the lookup again',
      instruction:
        'Re-run the recommended SELECT. Execution time should drop when the planner uses the new index.',
      action: 'run_sql',
    },
    {
      order: 5,
      title: 'Explain after the index',
      instruction:
        'Run EXPLAIN again. Expect index_scan_used=1 and much lower rows_scanned. Compare Metric Contract keys with the before snapshot.',
      action: 'run_explain_analyze',
    },
    {
      order: 6,
      title: 'Compare metrics',
      instruction:
        'Use Metrics Pipeline history (or explain responses) for before/after: rows_scanned, seq_scan_used, index_scan_used.',
      action: 'compare_metrics',
    },
    {
      order: 7,
      title: 'Optional: drop index and re-check',
      instruction:
        'Submit the recommended DROP INDEX SQL, then explain again to see sequential scan return.',
      action: 'drop_index_sql',
    },
    {
      order: 8,
      title: 'Optional: light benchmark',
      instruction:
        'Optionally enqueue the guided query via the existing Benchmark Runner APIs (no Index-specific benchmark endpoint).',
      action: 'optional_benchmark',
    },
    {
      order: 9,
      title: 'Take the quiz',
      instruction:
        'Pass the Index Playground quiz (100% correct) to mark the lab complete. Progress self-complete is quiz-gated.',
      action: 'take_quiz',
    },
  ],
  recommendedQuery: {
    sql: 'SELECT id, email, name FROM users WHERE email = $1',
    exampleParameters: ['user1@example.com'],
    paramHints: [
      'Pass parameters: ["user1@example.com"] (or any email that exists in the commerce seed). Do not run with an empty parameters array.',
    ],
    description:
      'Selective equality lookup on users.email (unindexed in baseline schema) to demonstrate seq scan vs index scan.',
  },
  recommendedCreateIndexSql: 'CREATE INDEX idx_users_email ON users (email)',
  recommendedDropIndexSql: 'DROP INDEX idx_users_email',
  quizRequired: true,
  dataset: {
    family: 'commerce',
    version: 'v1',
    recommendedTier: ['100k', '1m'],
  },
  optionalBenchmarkNote:
    'Optional: enqueue the guided SELECT via existing Benchmark Runner (POST benchmark enqueue) before and after the index to compare latency. No Index Playground-specific benchmark API.',
};
