import { DatasetTier } from '../dataset/dataset-tier.enum';

export interface BenchmarkTargetDataset {
  family: string;
  tier: DatasetTier;
  version?: string;
}

export interface BenchmarkTarget {
  sql: string;
  parameters: unknown[];
  dataset: BenchmarkTargetDataset;
}

export interface BenchmarkContext {
  trackSlug?: string;
  labSlug?: string;
  requestId?: string;
  userId?: string;
}
