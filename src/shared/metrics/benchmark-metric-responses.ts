import { BenchmarkProfile } from '../benchmark/benchmark-profile';
import { MetricContract } from './metric-contract';

export type BenchmarkMetricsStatus = 'pending' | 'ready' | 'unavailable';

export interface BenchmarkMetricsByJobResponse {
  jobId: string;
  runId?: string;
  status: string;
  profile: BenchmarkProfile;
  metricsStatus: BenchmarkMetricsStatus;
  metrics: MetricContract[];
  createdAt?: string;
  hint?: string;
}

export interface BenchmarkMetricSnapshotSummary {
  runId: string;
  jobId: string;
  runType: 'benchmark';
  createdAt: string;
  profile: BenchmarkProfile;
  metrics: MetricContract[];
  dataset: {
    family: string;
    tier: string;
    version: string;
  };
}

export interface BenchmarkMetricHistoryResponse {
  snapshots: BenchmarkMetricSnapshotSummary[];
  retentionLimit: number;
}
