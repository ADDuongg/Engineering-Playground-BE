import { Injectable, Logger } from '@nestjs/common';
import { BackgroundJob, JobFailureReason, JobType } from '@db-play/types';

export interface DeadLetterEvent {
  jobId: string;
  jobType: JobType;
  failureReason: JobFailureReason;
  attemptCount: number;
  sessionId: string | null;
  userId: string | null;
  failureMessage?: string;
}

@Injectable()
export class DeadLetterLogger {
  private readonly logger = new Logger(DeadLetterLogger.name);

  emit(event: DeadLetterEvent): void {
    this.logger.error(
      {
        event: 'job_dead_lettered',
        jobId: event.jobId,
        jobType: event.jobType,
        failureReason: event.failureReason,
        attemptCount: event.attemptCount,
        sessionId: event.sessionId,
        userId: event.userId,
        failureMessage: event.failureMessage,
      },
      `Job ${event.jobId} (${event.jobType}) moved to dead letter after ${event.attemptCount} attempt(s)`,
    );
  }

  emitFromJob(job: BackgroundJob, reason: JobFailureReason): void {
    this.emit({
      jobId: job.id,
      jobType: job.jobType,
      failureReason: reason,
      attemptCount: job.attemptCount,
      sessionId: job.sessionId,
      userId: job.userId,
      failureMessage: job.failureMessage,
    });
  }
}
