export type LabGuidedStepAction =
  | 'run_sql'
  | 'run_explain'
  | 'run_explain_analyze'
  | 'create_index_sql'
  | 'drop_index_sql'
  | 'compare_metrics'
  | 'take_quiz'
  | 'optional_benchmark';

export interface LabGuidedStep {
  order: number;
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
}

export interface GuidedSql {
  sql: string;
  /** Bound values for $1..$n — FE should send these (or user overrides) with the SQL */
  exampleParameters: unknown[];
  paramHints: string[];
  description: string;
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
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
  quizRequired: boolean;
  dataset: LabSummaryDatasetHint;
  optionalBenchmarkNote?: string | null;
}
