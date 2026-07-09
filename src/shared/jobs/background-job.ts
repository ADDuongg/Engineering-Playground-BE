import { JobFailureReason } from './job-failure-reason.enum';
import { JobStatus } from './job-status.enum';
import { JobType } from './job-type.enum';

export interface BackgroundJob {
  id: string;
  jobType: JobType;
  userId: string | null;
  sessionId: string | null;
  status: JobStatus;
  payloadSummary?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  maxAttempts: number;
  failureReason?: JobFailureReason;
  failureMessage?: string;
  deadLetteredAt?: string;
}
