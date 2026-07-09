import { DatasetReadinessStatus } from './dataset-readiness-status.enum';
import { DatasetTier } from './dataset-tier.enum';

export interface DatasetTableMetadata {
  name: string;
  label: string;
  description: string;
  targetRowCount: number;
  actualRowCount: number | null;
}

export interface DatasetMetadata {
  family: string;
  familyLabel: string;
  version: string;
  tier: DatasetTier;
  status: DatasetReadinessStatus;
  tables: DatasetTableMetadata[];
}

export interface DatasetPreparationError {
  code: string;
  message: string;
  hint?: string;
}

export interface DatasetPreparationStatus {
  family: string;
  version: string;
  tier: DatasetTier;
  status: DatasetReadinessStatus;
  startedAt?: string;
  completedAt?: string | null;
  durationMs?: number | null;
  error?: DatasetPreparationError | null;
}

export interface PrepareDatasetResult {
  family: string;
  version: string;
  tier: DatasetTier;
  status: DatasetReadinessStatus;
  durationMs?: number;
  startedAt?: string;
}
