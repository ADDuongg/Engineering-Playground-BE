import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import {
  BackgroundJob,
  ErrorCode,
  JobFailureReason,
  JobQueuePayload,
  JobStatus,
  JobType,
  SandboxViolationCode,
  SqlExecutionJobBody,
} from '@db-play/types';
import { DomainError } from '../common/errors/domain.error';
import { RunExperimentSqlUseCase } from '../modules/experiment-runner/application/run-experiment-sql.usecase';
import { DeadLetterLogger } from '../modules/worker-queue/infrastructure/dead-letter.logger';
import { JobStore } from '../modules/worker-queue/infrastructure/job.store';

@Injectable()
export class SqlExecutionWorkerProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SqlExecutionWorkerProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly jobStore: JobStore,
    private readonly runExperimentSql: RunExperimentSqlUseCase,
    private readonly deadLetterLogger: DeadLetterLogger,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      this.configService.get<string>(
        'sqlExecution.queueName',
        'sql-execution-jobs',
      ),
      async (job) =>
        this.processJob(job as Job<JobQueuePayload<SqlExecutionJobBody>>),
      {
        connection: this.buildConnection(),
        concurrency: this.configService.get<number>(
          'sqlExecution.workerConcurrency',
          5,
        ),
        lockDuration: this.jobTimeoutMs(),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        {
          event: 'sql_execution_worker_job_failed',
          jobId: job?.id,
          error: error.message,
        },
        'SQL execution worker job failed',
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private buildConnection(): {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
  } {
    return {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null,
    };
  }

  private jobTimeoutMs(): number {
    const timeoutSeconds = this.configService.get<number>(
      'sqlExecution.jobTimeoutSeconds',
      60,
    );
    return timeoutSeconds * 1000;
  }

  async processJob(
    bullJob: Job<JobQueuePayload<SqlExecutionJobBody>>,
  ): Promise<void> {
    const payload = bullJob.data;
    const existing = await this.jobStore.getById(payload.jobId);

    if (!existing || existing.jobType !== JobType.SQL_EXECUTION) {
      this.logger.warn({
        event: 'sql_execution_worker_missing_job',
        jobId: payload.jobId,
      });
      return;
    }

    if (existing.status === JobStatus.CANCELLED) {
      this.logger.log({
        event: 'sql_execution_worker_skipped_cancelled',
        jobId: payload.jobId,
      });
      return;
    }

    const sessionId = payload.sessionId ?? existing.sessionId;
    if (!sessionId) {
      const failed = await this.failTerminal(
        existing,
        JobFailureReason.VALIDATION_ERROR,
        'SQL run job is missing session identity.',
      );
      this.deadLetterLogger.emitFromJob(failed, failed.failureReason!);
      return;
    }

    let job = await this.jobStore.markRunning(existing);
    const { sql, parameters, dataset, context } = payload.body;

    const enqueuedAt = new Date(existing.createdAt).getTime();
    const startedAt = job.startedAt
      ? new Date(job.startedAt).getTime()
      : Date.now();
    this.logger.log({
      event: 'sql_execution_started',
      jobId: job.id,
      sessionId,
      waitMs: Math.max(0, startedAt - enqueuedAt),
    });

    try {
      const result = await this.runExperimentSql.execute({
        sql,
        parameters,
        sessionId,
        dataset,
        context: {
          requestId: context?.requestId,
          trackSlug: context?.trackSlug,
          labSlug: context?.labSlug,
          userId: context?.userId,
          preAuthorized: true,
        },
      });

      const withResult: BackgroundJob = {
        ...job,
        payloadSummary: {
          ...job.payloadSummary,
          executionResult: result as unknown as Record<string, unknown>,
        },
      };
      job = await this.jobStore.markCompleted(withResult);

      this.logger.log({
        event: 'sql_execution_completed',
        jobId: job.id,
        sessionId,
        rowCount: result.rowCount,
        truncated: result.truncated,
      });
      return;
    } catch (error) {
      await this.handleFailure(job, error);
    }
  }

  private async handleFailure(
    job: BackgroundJob,
    error: unknown,
  ): Promise<void> {
    const reason = this.classifyFailure(error);
    const message = this.failureMessage(error);
    const retryable = this.isRetryable(error);
    const attemptsExhausted = job.attemptCount >= job.maxAttempts;

    if (!retryable || attemptsExhausted) {
      const failed = await this.jobStore.markFailed(job, reason, message, {
        deadLetter: !retryable ? false : attemptsExhausted,
      });

      if (!retryable) {
        this.logger.warn({
          event: 'sql_execution_failed_terminal',
          jobId: failed.id,
          failureReason: reason,
        });
        return;
      }

      this.deadLetterLogger.emitFromJob(failed, reason);
      return;
    }

    // Transient failure with attempts remaining: keep RUNNING and let BullMQ retry.
    this.logger.warn({
      event: 'sql_execution_retrying',
      jobId: job.id,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      message,
    });
    throw error instanceof Error ? error : new Error(message);
  }

  private classifyFailure(error: unknown): JobFailureReason {
    if (error instanceof DomainError) {
      const details = error.details as
        | { reason?: string; violationCode?: SandboxViolationCode }
        | undefined;

      if (
        error.code === ErrorCode.TIMEOUT ||
        details?.violationCode === SandboxViolationCode.QUERY_TIMEOUT
      ) {
        return JobFailureReason.TIMEOUT;
      }
      if (error.code === ErrorCode.VALIDATION_ERROR) {
        return JobFailureReason.VALIDATION_ERROR;
      }
      if (
        details?.reason === 'SESSION_NOT_READY' ||
        details?.reason === 'SESSION_UNAVAILABLE'
      ) {
        return JobFailureReason.SESSION_UNAVAILABLE;
      }
      return JobFailureReason.EXECUTION_ERROR;
    }
    return JobFailureReason.EXECUTION_ERROR;
  }

  /** DomainErrors are deterministic and must not be retried. */
  private isRetryable(error: unknown): boolean {
    return !(error instanceof DomainError);
  }

  private failureMessage(error: unknown): string {
    if (error instanceof DomainError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message.slice(0, 300);
    }
    return 'SQL run failed to complete successfully.';
  }

  private async failTerminal(
    job: BackgroundJob,
    reason: JobFailureReason,
    message: string,
  ): Promise<BackgroundJob> {
    return this.jobStore.markFailed(job, reason, message, { deadLetter: true });
  }
}
