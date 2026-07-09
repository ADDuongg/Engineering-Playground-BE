import { DatasetTier } from './dataset-tier.enum';

export interface DatasetResetContext {
  requestId?: string;
  labSlug?: string;
  userId?: string;
}

export interface ResetDatasetInput {
  family: string;
  tier: DatasetTier;
  version?: string;
  sessionId?: string;
  context?: DatasetResetContext;
}
