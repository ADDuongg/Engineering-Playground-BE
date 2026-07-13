import { MetricContract } from '../metrics/metric-contract';
import { RuntimeAdapterType } from '../tracks/runtime-adapter-type.enum';

/**
 * Track-agnostic context passed to every Runtime Adapter run.
 * Adapters use it for logging, metric attribution and session resolution.
 */
export interface RuntimeExperimentContext {
  requestId?: string;
  trackSlug?: string;
  labSlug?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Uniform result every Runtime Adapter returns: normalized Metric Contract
 * metrics plus an adapter-specific raw payload (rows, render tree, …).
 */
export interface RuntimeExperimentResult<TRaw = unknown> {
  adapterType: RuntimeAdapterType;
  metrics: MetricContract[];
  raw?: TRaw;
}
