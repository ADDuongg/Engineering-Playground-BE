import { BackgroundJob, JobFailureReason, JobStatus, JobType } from '@db-play/types';

export interface GetJobStatusResult {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  maxAttempts: number;
  failureReason?: JobFailureReason;
  failureMessage?: string;
  payloadSummary?: Record<string, unknown>;
  deadLetteredAt?: string;
}

export function toJobStatusResult(job: BackgroundJob): GetJobStatusResult {
  return {
    jobId: job.id,
    jobType: job.jobType,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    failureReason: job.failureReason,
    failureMessage: job.failureMessage,
    payloadSummary: job.payloadSummary,
    deadLetteredAt: job.deadLetteredAt,
  };
}
