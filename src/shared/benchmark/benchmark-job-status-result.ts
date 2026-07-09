import { MetricContract } from '../metrics/metric-contract';
import { BenchmarkMetricsStatus } from '../metrics/benchmark-metric-responses';
import { BenchmarkFailureReason } from './benchmark-failure-reason.enum';
import { BenchmarkJobStatus } from './benchmark-job-status.enum';
import { BenchmarkProfile } from './benchmark-profile';

export interface BenchmarkJobStatusResult {
  jobId: string;
  status: BenchmarkJobStatus;
  profile: BenchmarkProfile;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: BenchmarkFailureReason;
  hint?: string;
  metricsStatus?: BenchmarkMetricsStatus;
  metrics?: MetricContract[];
  runId?: string;
}
