import { DatasetTier } from '../dataset/dataset-tier.enum';
import { ExplainMode } from './explain-mode.enum';

export interface ExplainDatasetRef {
  family: string;
  tier: DatasetTier;
  version?: string;
}

export interface ExplainExecutionContext {
  requestId?: string;
  trackSlug?: string;
  labSlug?: string;
  userId?: string;
}

export interface ExplainRunInput {
  sql: string;
  parameters: unknown[];
  explainMode: ExplainMode;
  dataset: ExplainDatasetRef;
  sessionId?: string;
  context?: ExplainExecutionContext;
}
