import { DatasetTier } from '../dataset/dataset-tier.enum';

export interface ExperimentDatasetRef {
  family: string;
  tier: DatasetTier;
  version?: string;
}

export interface ExperimentExecutionContext {
  requestId?: string;
  trackSlug?: string;
  labSlug?: string;
  userId?: string;
  /** Set when request is authenticated internal benchmark load traffic. */
  benchmarkInternal?: boolean;
  /**
   * Set when the run's rate-limit quota was already charged at an earlier
   * boundary (e.g. the SQL execution queue enqueue step). Prevents the
   * execution path from re-charging quota on worker execution or retry.
   */
  preAuthorized?: boolean;
}

export interface ExperimentRunInput {
  sql: string;
  parameters: unknown[];
  dataset: ExperimentDatasetRef;
  sessionId?: string;
  context?: ExperimentExecutionContext;
}
