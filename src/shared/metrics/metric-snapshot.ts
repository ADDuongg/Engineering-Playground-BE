import { MetricContract } from './metric-contract';
import { MetricRunType } from './metric-run-context';

export interface MetricSnapshotSummary {
  runId: string;
  runType: MetricRunType;
  createdAt: string;
  metrics: MetricContract[];
  dataset: {
    family: string;
    tier: string;
    version: string;
  };
}

export interface MetricHistoryResponse {
  snapshots: MetricSnapshotSummary[];
  retentionLimit: number;
}

export interface CollectMetricsResult {
  metrics: MetricContract[];
  omittedMetricKeys?: string[];
}
