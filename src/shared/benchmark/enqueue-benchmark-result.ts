import { BenchmarkJobStatus } from './benchmark-job-status.enum';
import { BenchmarkProfile } from './benchmark-profile';

export interface EnqueueBenchmarkResult {
  jobId: string;
  status: BenchmarkJobStatus.QUEUED;
  profile: BenchmarkProfile;
  createdAt: string;
}
