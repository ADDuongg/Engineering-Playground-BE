import { DatasetTier } from '../dataset/dataset-tier.enum';
import { ExplainMode } from './explain-mode.enum';
import { ExplainPlanNode } from './explain-plan-node';
import { MetricContract } from '../metrics/metric-contract';

export interface ExplainRunResult {
  plan: ExplainPlanNode;
  planningTimeMs?: number;
  executionTimeMs: number;
  explainMode: ExplainMode;
  statementKind: ExplainMode;
  dataset: {
    family: string;
    tier: DatasetTier;
    version: string;
  };
  truncated?: boolean;
  rawPlanText?: string;
  metrics?: MetricContract[];
  runId?: string;
  omittedMetricKeys?: string[];
}
