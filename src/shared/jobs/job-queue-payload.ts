import { JobType } from './job-type.enum';

/**
 * Minimal BullMQ payload. Full status lives in JobStore (`BackgroundJob`).
 */
export interface JobQueuePayload<TBody = Record<string, unknown>> {
  jobId: string;
  jobType: JobType;
  sessionId: string | null;
  userId: string | null;
  body: TBody;
}
