import { DatasetTier } from './dataset-tier.enum';

export interface DatasetPreparationContext {
  requestId?: string;
  labSlug?: string;
  trackSlug?: string;
  userId?: string;
}

export interface PrepareDatasetInput {
  family: string;
  tier: DatasetTier;
  version?: string;
  sessionId?: string;
  context?: DatasetPreparationContext;
}
