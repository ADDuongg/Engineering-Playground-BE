import { ReactScenarioPayload } from '../labs/lab-summary';

/**
 * Input for the Frontend React Runtime Adapter. `action` mirrors the lab
 * guided-step action (render_component, inspect_hooks, …); `scenario` carries
 * the component/interaction definition to run in the headless React sandbox.
 */
export interface ReactExperimentInput {
  action: string;
  scenario: ReactScenarioPayload;
}

/** Adapter-specific raw payload describing what the React sandbox executed. */
export interface ReactExperimentRaw {
  action: string;
  scenarioId?: string;
  interactionCount: number;
  notes: string[];
}
