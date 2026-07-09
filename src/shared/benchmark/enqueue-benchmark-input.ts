import { BenchmarkProfile } from './benchmark-profile';
import { BenchmarkContext, BenchmarkTarget } from './benchmark-target';

export interface EnqueueBenchmarkInput {
  sessionId: string;
  profile: BenchmarkProfile;
  target: BenchmarkTarget;
  context?: BenchmarkContext;
}
