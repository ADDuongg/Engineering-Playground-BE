import { DatasetTier } from '../dataset/dataset-tier.enum';
import { RuntimeAdapterType } from '../tracks/runtime-adapter-type.enum';
import { ExperimentSessionStatus } from './experiment-session-status.enum';

export interface ExperimentSessionDatasetRef {
  family: string;
  tier: DatasetTier;
  version?: string;
}

export interface ExperimentSessionContext {
  requestId?: string;
  userId?: string;
}

export interface ExperimentSessionError {
  code: string;
  message: string;
  hint?: string;
}

export interface ExperimentSession {
  sessionId: string;
  clientSessionToken: string;
  status: ExperimentSessionStatus;
  trackSlug: string;
  labSlug: string;
  runtimeAdapter: RuntimeAdapterType;
  schemaName: string;
  dataset: ExperimentSessionDatasetRef;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  error?: ExperimentSessionError;
}

export interface ExperimentSessionSummary {
  sessionId: string;
  status: ExperimentSessionStatus;
  trackSlug: string;
  labSlug: string;
  runtimeAdapter: RuntimeAdapterType;
  schemaName?: string;
  dataset: ExperimentSessionDatasetRef & { version: string };
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  reused?: boolean;
}

export interface TeardownExperimentSessionResult {
  sessionId: string;
  status: ExperimentSessionStatus.EXPIRED;
  durationMs: number;
}
