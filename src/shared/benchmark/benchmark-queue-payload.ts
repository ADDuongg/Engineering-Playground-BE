import { BenchmarkContext, BenchmarkTarget } from './benchmark-target';
import { BenchmarkProfile } from './benchmark-profile';

export interface BenchmarkQueuePayload {
  jobId: string;
  userId: string | null;
  sessionId: string;
  profile: BenchmarkProfile;
  target: BenchmarkTarget;
  context?: BenchmarkContext;
}
