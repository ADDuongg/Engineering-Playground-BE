import { Injectable, Logger } from '@nestjs/common';
import { JOB_INFLIGHT_STATUSES } from '@db-play/types';
import { JobStore } from '../infrastructure/job.store';
import { JobQueueProducer } from '../infrastructure/job-queue.producer';

export interface CancelSessionJobsInput {
  sessionId: string;
  reason?: 'SESSION_TEARDOWN';
}

export interface CancelSessionJobsResult {
  cancelledCount: number;
  jobIds: string[];
}

@Injectable()
export class CancelSessionJobsUseCase {
  private readonly logger = new Logger(CancelSessionJobsUseCase.name);

  constructor(
    private readonly jobStore: JobStore,
    private readonly queueProducer: JobQueueProducer,
  ) {}

  async execute(input: CancelSessionJobsInput): Promise<CancelSessionJobsResult> {
    const jobs = await this.jobStore.listBySession(input.sessionId);
    const cancelledIds: string[] = [];

    for (const job of jobs) {
      if (!JOB_INFLIGHT_STATUSES.includes(job.status)) {
        continue;
      }

      await this.queueProducer.remove(job.jobType, job.id);
      await this.jobStore.markCancelled(job);
      cancelledIds.push(job.id);

      this.logger.log(
        {
          event: 'job_cancelled',
          jobId: job.id,
          jobType: job.jobType,
          sessionId: input.sessionId,
          reason: input.reason ?? 'SESSION_TEARDOWN',
        },
        'Background job cancelled due to session lifecycle',
      );
    }

    return {
      cancelledCount: cancelledIds.length,
      jobIds: cancelledIds,
    };
  }
}
