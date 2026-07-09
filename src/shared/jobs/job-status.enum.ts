export enum JobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const JOB_STATUSES = Object.values(JobStatus);

export const JOB_INFLIGHT_STATUSES: JobStatus[] = [
  JobStatus.QUEUED,
  JobStatus.RUNNING,
];

export const JOB_TERMINAL_STATUSES: JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.FAILED,
  JobStatus.CANCELLED,
];
