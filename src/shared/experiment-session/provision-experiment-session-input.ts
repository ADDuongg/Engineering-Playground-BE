import {
  ExperimentSessionContext,
  ExperimentSessionDatasetRef,
} from './experiment-session';

export interface ProvisionExperimentSessionInput {
  clientSessionToken: string;
  trackSlug: string;
  labSlug: string;
  dataset: ExperimentSessionDatasetRef;
  context?: ExperimentSessionContext;
}

export interface GetExperimentSessionInput {
  sessionId: string;
}

export interface TeardownExperimentSessionInput {
  sessionId: string;
  context?: ExperimentSessionContext;
}
