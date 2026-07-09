import { JobStatus } from '../jobs/job-status.enum';
import { JobType } from '../jobs/job-type.enum';
import { ExperimentDatasetRef } from './experiment-run-input';

export interface EnqueueSqlRunInput {
  sql: string;
  parameters?: unknown[];
  sessionId: string;
  dataset: ExperimentDatasetRef;
  context?: {
    requestId?: string;
    trackSlug?: string;
    labSlug?: string;
    userId?: string;
  };
}

export interface EnqueueSqlRunResult {
  jobId: string;
  jobType: JobType.SQL_EXECUTION;
  status: JobStatus.QUEUED;
  createdAt: string;
}
