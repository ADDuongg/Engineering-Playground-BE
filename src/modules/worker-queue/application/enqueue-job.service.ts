import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BackgroundJob,
  JobQueuePayload,
  JobStatus,
  JobType,
} from '@db-play/types';
import { JobStore } from '../infrastructure/job.store';
import { JobQueueProducer } from '../infrastructure/job-queue.producer';

export interface EnqueueJobInput<TBody = Record<string, unknown>> {
  jobType: JobType;
  userId?: string | null;
  sessionId?: string | null;
  body: TBody;
  payloadSummary?: Record<string, unknown>;
  jobId?: string;
}

export interface EnqueueJobResult {
  job: BackgroundJob;
}

/**
 * Creates a JobStore row then enqueues. On queue failure, deletes the row
 * so callers never observe an ambiguous half-created job (FR-010).
 */
@Injectable()
export class EnqueueJobService {
  private readonly logger = new Logger(EnqueueJobService.name);

  constructor(
    private readonly jobStore: JobStore,
    private readonly queueProducer: JobQueueProducer,
  ) {}

  async enqueue<TBody = Record<string, unknown>>(
    input: EnqueueJobInput<TBody>,
  ): Promise<EnqueueJobResult> {
    const jobId = input.jobId ?? randomUUID();
    const maxAttempts = this.queueProducer.getMaxAttempts(input.jobType);
    const createdAt = new Date().toISOString();

    const job: BackgroundJob = {
      id: jobId,
      jobType: input.jobType,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      status: JobStatus.QUEUED,
      payloadSummary: input.payloadSummary,
      createdAt,
      attemptCount: 0,
      maxAttempts,
    };

    await this.jobStore.save(job);

    const payload: JobQueuePayload<TBody> = {
      jobId,
      jobType: input.jobType,
      sessionId: input.sessionId ?? null,
      userId: input.userId ?? null,
      body: input.body,
    };

    try {
      await this.queueProducer.enqueue(payload as JobQueuePayload);
      this.logger.log(
        {
          event: 'job_enqueued',
          jobId,
          jobType: input.jobType,
          sessionId: input.sessionId,
        },
        'Background job enqueued',
      );
      return { job };
    } catch (error) {
      await this.jobStore.delete(jobId);
      throw error;
    }
  }
}
