export enum BenchmarkJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const BENCHMARK_JOB_STATUSES = Object.values(BenchmarkJobStatus);

export const BENCHMARK_INFLIGHT_STATUSES: BenchmarkJobStatus[] = [
  BenchmarkJobStatus.QUEUED,
  BenchmarkJobStatus.RUNNING,
];
