import { BenchmarkJobStatus } from './benchmark-job-status.enum';
import { BenchmarkProfile } from './benchmark-profile';

/** Mid-run provisional metric; never treated as final Benchmark Metrics history. */
export interface PartialMetric {
  key: string;
  label: string;
  unit: string;
  value: number;
  group: string;
  provisional: true;
}

export type BenchmarkProgressElapsedBasis = 'queue' | 'execution';

/**
 * Ephemeral point-in-time progress for one benchmark job (Redis latest-only).
 * Terminal snapshots close the SSE stream and MUST NOT carry final Metric Contract arrays.
 */
export interface BenchmarkProgressSnapshot {
  jobId: string;
  phase: BenchmarkJobStatus;
  elapsedMs: number;
  elapsedBasis: BenchmarkProgressElapsedBasis;
  /** Measured achieved RPS; null/omitted until load observations exist. */
  currentRps?: number | null;
  /** Provisional catalog subset; omit or empty when no observations (never invent zeros). */
  partialMetrics?: PartialMetric[];
  provisional: true;
  terminal: boolean;
  profile?: BenchmarkProfile;
  updatedAt: string;
  hint?: string;
}
