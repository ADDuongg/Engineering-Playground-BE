export const LAB_GUIDED_STEP_ACTIONS = [
  // Database / SQL track
  'run_sql',
  'run_explain',
  'run_explain_analyze',
  'create_index_sql',
  'drop_index_sql',
  'optional_benchmark',
  // Frontend React track (headless React sandbox runtime)
  'render_component',
  'update_props',
  'update_state',
  'remount',
  'toggle_memo',
  'compare_reconciliation',
  'inspect_hooks',
  // Track-agnostic
  'compare_metrics',
  'take_quiz',
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
 * Per-step scenario for React (headless React sandbox) guided steps.
 * Stored inside `LabGuidedStepPayload` (jsonb) — the executable "logic" lives here,
 * never in the shared curriculum columns (which stay Database/SQL-specific).
 */
export interface ReactScenarioPayload {
  /** Stable id of a scenario bundled in the React Runtime Adapter (preferred). */
  scenarioId?: string;
  /** Inline component source when a scenario is authored ad-hoc. */
  componentSource?: string;
  /** Initial props passed to the scenario root. */
  props?: Record<string, unknown>;
  /** Ordered prop/state changes or events used to trigger renders. */
  interactions?: unknown[];
  /** Scenario knobs (memoization, key strategy, …). */
  options?: {
    memo?: boolean;
    keyStrategy?: 'index' | 'stable';
    [key: string]: unknown;
  };
  /** Human-readable summary of what the step demonstrates. */
  description?: string;
}

/**
 * Per-step Apply content. Primary home for recommended SQL/DDL (admin-editable via step CRUD).
 * - `run_sql` / `run_explain` / `run_explain_analyze`: prefer `recommendedQuery`
 * - `create_index_sql` / `drop_index_sql`: prefer `sql`
 * - React actions (`render_component`, `inspect_hooks`, …): prefer `reactScenario`
 */
export interface LabGuidedStepPayload {
  recommendedQuery?: GuidedSql;
  sql?: string;
  reactScenario?: ReactScenarioPayload;
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
  /** Database/SQL-only; omitted for tracks without a playground dataset. */
  dataset?: LabSummaryDatasetHint | null;
  /** Optional per-track lab-level metadata. */
  config?: Record<string, unknown> | null;
  optionalBenchmarkNote?: string | null;
}
