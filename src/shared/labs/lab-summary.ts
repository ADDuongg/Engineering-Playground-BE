export const LAB_GUIDED_STEP_ACTIONS = [
  'run_sql',
  'run_explain',
  'run_explain_analyze',
  'create_index_sql',
  'drop_index_sql',
  'compare_metrics',
  'take_quiz',
  'optional_benchmark',
] as const;

export type LabGuidedStepAction = (typeof LAB_GUIDED_STEP_ACTIONS)[number];

export interface GuidedSql {
  sql: string;
  /** Bound values for $1..$n — FE should send these (or user overrides) with the SQL */
  exampleParameters: unknown[];
  paramHints: string[];
  description: string;
}

/**
 * Per-step Apply content. Primary home for recommended SQL/DDL (admin-editable via step CRUD).
 * - `run_sql` / `run_explain` / `run_explain_analyze`: prefer `recommendedQuery`
 * - `create_index_sql` / `drop_index_sql`: prefer `sql`
 */
export interface LabGuidedStepPayload {
  recommendedQuery?: GuidedSql;
  sql?: string;
  [key: string]: unknown;
}

export interface LabGuidedStep {
  order: number;
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  /** Recommended SQL/DDL for this step; null when unused */
  payload: LabGuidedStepPayload | null;
}

export interface LabSummaryDatasetHint {
  family: string;
  version: string;
  recommendedTier: string[];
}

export interface LabSummaryResponse {
  labSlug: string;
  trackSlug: string;
  title: string;
  learningGoal: string;
  theory: string;
  guidedSteps: LabGuidedStep[];
  /**
   * Compatibility field: first matching step payload query, else curriculum.
   * Prefer reading `guidedSteps[].payload` for Apply buttons.
   */
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
  quizRequired: boolean;
  dataset: LabSummaryDatasetHint;
  optionalBenchmarkNote?: string | null;
}
