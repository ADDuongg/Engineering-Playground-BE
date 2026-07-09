import { BenchmarkJobStatus } from './benchmark-job-status.enum';
import { BenchmarkProfile } from './benchmark-profile';

export const BENCHMARK_FINISHED_EVENT = 'benchmark.finished';

export interface BenchmarkFinishedEvent {
  jobId: string;
  sessionId: string;
  userId: string | null;
  status: BenchmarkJobStatus.COMPLETED | BenchmarkJobStatus.FAILED;
  profile: BenchmarkProfile;
  k6Summary?: Record<string, unknown>;
  failureReason?: string;
}
