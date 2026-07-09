import { BenchmarkFailureReason } from './benchmark-failure-reason.enum';
import { BenchmarkJobStatus } from './benchmark-job-status.enum';
import { BenchmarkProfile } from './benchmark-profile';
import { BenchmarkContext, BenchmarkTarget } from './benchmark-target';

export interface BenchmarkJob {
  id: string;
  userId: string | null;
  sessionId: string;
  status: BenchmarkJobStatus;
  profile: BenchmarkProfile;
  target: BenchmarkTarget;
  context?: BenchmarkContext;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: BenchmarkFailureReason;
  failureMessage?: string;
  k6Summary?: Record<string, unknown>;
}
