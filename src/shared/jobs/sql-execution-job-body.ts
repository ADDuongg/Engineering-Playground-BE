import {
  ExperimentDatasetRef,
  ExperimentExecutionContext,
} from '../experiment/experiment-run-input';

/**
 * BullMQ payload body for a queued interactive SQL run. The full lifecycle
 * status and (on completion) the embedded ExperimentRunResult live in JobStore.
 */
export interface SqlExecutionJobBody {
  sql: string;
  parameters: unknown[];
  dataset: ExperimentDatasetRef;
  context?: ExperimentExecutionContext;
}
