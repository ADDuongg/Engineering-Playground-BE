import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ErrorCode, JobQueuePayload, JobType } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

interface QueueConfig {
  queueName: string;
  maxAttempts: number;
  backoffDelayMs: number;
}

@Injectable()
export class JobQueueProducer implements OnModuleDestroy {
  private readonly logger = new Logger(JobQueueProducer.name);
  private readonly queues = new Map<JobType, Queue>();

  constructor(private readonly configService: ConfigService) {}

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

  private resolveQueueConfig(jobType: JobType): QueueConfig {
    switch (jobType) {
      case JobType.BENCHMARK:
        return {
          queueName: this.configService.get<string>(
            'benchmark.queueName',
            'benchmark-jobs',
          ),
          maxAttempts: this.configService.get<number>(
            'benchmark.maxAttempts',
            2,
          ),
          backoffDelayMs: this.configService.get<number>(
            'benchmark.backoffDelayMs',
            2000,
          ),
        };
      case JobType.DATASET_RESET:
        return {
          queueName: this.configService.get<string>(
            'datasetReset.queueName',
            'dataset-reset-jobs',
          ),
          maxAttempts: this.configService.get<number>(
            'datasetReset.maxAttempts',
            3,
          ),
          backoffDelayMs: this.configService.get<number>(
            'datasetReset.backoffDelayMs',
            2000,
          ),
        };
      case JobType.SQL_EXECUTION:
        return {
          queueName: this.configService.get<string>(
            'sqlExecution.queueName',
            'sql-execution-jobs',
          ),
          maxAttempts: this.configService.get<number>(
            'sqlExecution.maxAttempts',
            2,
          ),
          backoffDelayMs: this.configService.get<number>(
            'sqlExecution.backoffDelayMs',
            1000,
          ),
        };
      default: {
        const exhaustive: never = jobType;
        throw new Error(`Unsupported job type: ${String(exhaustive)}`);
      }
    }
  }

  private getQueue(jobType: JobType): Queue {
    const existing = this.queues.get(jobType);
    if (existing) {
      return existing;
    }

    const config = this.resolveQueueConfig(jobType);
    const queue = new Queue(config.queueName, {
      connection: this.buildConnection(),
      defaultJobOptions: {
        attempts: config.maxAttempts,
        backoff: { type: 'fixed', delay: config.backoffDelayMs },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.queues.set(jobType, queue);
    return queue;
  }

  getMaxAttempts(jobType: JobType): number {
    return this.resolveQueueConfig(jobType).maxAttempts;
  }

  getQueueName(jobType: JobType): string {
    return this.resolveQueueConfig(jobType).queueName;
  }

  async enqueue(payload: JobQueuePayload): Promise<void> {
    try {
      const queue = this.getQueue(payload.jobType);
      await queue.add('run', payload, {
        jobId: payload.jobId,
      });
    } catch (error) {
      this.logger.error(
        {
          event: 'job_enqueue_failed',
          jobId: payload.jobId,
          jobType: payload.jobType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to enqueue background job',
      );

      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        'Job queue is temporarily unavailable. Try again shortly.',
        503,
        { reason: 'QUEUE_UNAVAILABLE' },
      );
    }
  }

  async remove(jobType: JobType, jobId: string): Promise<void> {
    try {
      const queue = this.getQueue(jobType);
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      this.logger.warn(
        {
          event: 'job_remove_failed',
          jobId,
          jobType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to remove queued job',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.queues.values()].map(async (queue) => queue.close()),
    );
  }
}
