import { DatasetTier } from '../dataset/dataset-tier.enum';
import { SqlStatementKind } from '../sandbox/sql-statement-kind.enum';
import { MetricContract } from '../metrics/metric-contract';

export interface ExperimentFieldMeta {
  name: string;
  dataTypeId: number;
}

export interface ExperimentRunResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  fields?: ExperimentFieldMeta[];
  dataset: {
    family: string;
    tier: DatasetTier;
    version: string;
  };
  statementKind: SqlStatementKind;
  metrics?: MetricContract[];
  runId?: string;
  omittedMetricKeys?: string[];
}
