import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import {
  JobFailureReason,
  JobQueuePayload,
  JobStatus,
} from '@db-play/types';
import { ExecuteDatasetResetService } from '../modules/dataset-loader/application/execute-dataset-reset.service';
import { DatasetResetJobBody } from '../modules/dataset-loader/application/reset-dataset.usecase';
import { DeadLetterLogger } from '../modules/worker-queue/infrastructure/dead-letter.logger';
import { JobStore } from '../modules/worker-queue/infrastructure/job.store';

@Injectable()
export class DatasetResetWorkerProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatasetResetWorkerProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly jobStore: JobStore,
    private readonly executeDatasetReset: ExecuteDatasetResetService,
    private readonly deadLetterLogger: DeadLetterLogger,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      this.configService.get<string>(
        'datasetReset.queueName',
        'dataset-reset-jobs',
      ),
      async (job) =>
        this.processJob(job.data as JobQueuePayload<DatasetResetJobBody>),
      {
        connection: this.buildConnection(),
        concurrency: this.configService.get<number>(
          'datasetReset.workerConcurrency',
          2,
        ),
        lockDuration: this.jobTimeoutMs(),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        {
          event: 'dataset_reset_worker_job_failed',
          jobId: job?.id,
          error: error.message,
        },
        'Dataset reset worker job failed',
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
      'datasetReset.jobTimeoutSeconds',
      600,
    );
    return timeoutSeconds * 1000;
  }

  async processJob(
    payload: JobQueuePayload<DatasetResetJobBody>,
  ): Promise<void> {
    const existing = await this.jobStore.getById(payload.jobId);

    if (!existing) {
      this.logger.warn({
        event: 'dataset_reset_worker_missing_job',
        jobId: payload.jobId,
      });
      return;
    }

    if (existing.status === JobStatus.CANCELLED) {
      this.logger.log({
        event: 'dataset_reset_worker_skipped_cancelled',
        jobId: payload.jobId,
      });
      return;
    }

    let job = await this.jobStore.markRunning(existing);

    try {
      await this.executeDatasetReset.execute({
        family: payload.body.family,
        tier: payload.body.tier,
        version: payload.body.version,
        sessionId: payload.body.sessionId,
        schemaName: payload.body.schemaName,
        context: payload.body.context,
      });

      await this.jobStore.markCompleted(job);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Dataset reset failed to complete successfully.';

      const maxAttempts = job.maxAttempts;
      const attemptsExhausted = job.attemptCount >= maxAttempts;

      job = await this.jobStore.markFailed(
        job,
        JobFailureReason.EXECUTION_ERROR,
        message,
        { deadLetter: attemptsExhausted },
      );

      if (attemptsExhausted) {
        this.deadLetterLogger.emitFromJob(
          job,
          JobFailureReason.EXECUTION_ERROR,
        );
        return;
      }

      throw error;
    }
  }
}
