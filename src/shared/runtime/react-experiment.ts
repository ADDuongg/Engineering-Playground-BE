import { ReactScenarioPayload } from '../labs/lab-summary';

/**
 * Input for the Frontend React Runtime Adapter. `action` mirrors the lab
 * guided-step action (render_component, inspect_hooks, …); `scenario` carries
 * the fixture id plus props/interactions/options. MVP executes built-in
 * fixtures only — non-empty `componentSource` is rejected at the HTTP boundary.
 */
export interface ReactExperimentInput {
  action: string;
  /** Lab slug required for allowlist checks (set by orchestration before adapter). */
  labSlug?: string;
  scenario: ReactScenarioPayload & {
    /** Preferred alias for built-in fixture id (same as scenarioId). */
    fixtureId?: string;
  };
}

/** Adapter-specific raw payload describing what the React sandbox executed. */
export interface ReactExperimentRaw {
  action: string;
  scenarioId?: string;
  interactionCount: number;
  notes: string[];
}

/** Learner-facing HTTP / use-case command for React experiments. */
export interface RunReactExperimentCommand {
  action: string;
  fixtureId: string;
  labSlug: string;
  trackSlug?: string;
  props?: Record<string, unknown>;
  interactions?: unknown[];
  options?: {
    memo?: boolean;
    keyStrategy?: 'index' | 'stable';
    [key: string]: unknown;
  };
  /** Rejected when non-empty (MVP: built-in fixtures only). */
  componentSource?: string;
  requestId?: string;
  userId?: string;
}
