import { DatasetTier } from '../dataset/dataset-tier.enum';
import { BenchmarkProfile } from '../benchmark/benchmark-profile';

export type MetricRunType = 'execution' | 'explain' | 'benchmark';

export interface MetricRunContext {
  sessionId?: string;
  trackSlug?: string;
  labSlug?: string;
  requestId?: string;
  userId?: string;
  runType: MetricRunType;
  dataset: {
    family: string;
    tier: DatasetTier;
    version: string;
  };
  metricCatalogId?: string;
  /** Benchmark job id — required when runType is `benchmark`. */
  jobId?: string;
  /** Load profile — required when runType is `benchmark`. */
  profile?: BenchmarkProfile;
}
