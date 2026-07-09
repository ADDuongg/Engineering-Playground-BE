import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job, Worker } from 'bullmq';
import {
  BackgroundJob,
  BENCHMARK_FINISHED_EVENT,
  BenchmarkContext,
  BenchmarkFinishedEvent,
  BenchmarkJobStatus,
  BenchmarkProfile,
  BenchmarkProgressSnapshot,
  BenchmarkTarget,
  JobFailureReason,
  JobQueuePayload,
  JobStatus,
  JobType,
} from '@db-play/types';
import { GetExperimentSessionUseCase } from '../modules/experiment-isolation/application/get-experiment-session.usecase';
import { K6BenchmarkExecutor } from '../modules/benchmark-runner/infrastructure/k6-benchmark.executor';
import { K6ProgressMapper } from '../modules/benchmark-runner/infrastructure/k6-progress.mapper';
import { BenchmarkProgressStore } from '../modules/benchmark-runner/infrastructure/benchmark-progress.store';
import { DeadLetterLogger } from '../modules/worker-queue/infrastructure/dead-letter.logger';
import { JobStore } from '../modules/worker-queue/infrastructure/job.store';

export interface BenchmarkJobBody {
  profile: BenchmarkProfile;
  target: BenchmarkTarget;
  context?: BenchmarkContext;
}

@Injectable()
export class BenchmarkWorkerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BenchmarkWorkerProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly jobStore: JobStore,
    private readonly deadLetterLogger: DeadLetterLogger,
    private readonly k6Executor: K6BenchmarkExecutor,
    private readonly progressMapper: K6ProgressMapper,
    private readonly progressStore: BenchmarkProgressStore,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      this.configService.get<string>('benchmark.queueName', 'benchmark-jobs'),
      async (job) =>
        this.processJob(job as Job<JobQueuePayload<BenchmarkJobBody>>),
      {
        connection: this.buildConnection(),
        concurrency: this.configService.get<number>(
          'benchmark.workerConcurrency',
          2,
        ),
        lockDuration: this.jobTimeoutMs(),
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        {
          event: 'benchmark_worker_job_failed',
          jobId: job?.id,
          error: error.message,
        },
        'Benchmark worker job failed',
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
      'benchmark.jobTimeoutSeconds',
      120,
    );
    return timeoutSeconds * 1000;
  }

  async processJob(
    bullJob: Job<JobQueuePayload<BenchmarkJobBody>>,
  ): Promise<void> {
    const payload = bullJob.data;
    const existing = await this.jobStore.getById(payload.jobId);

    if (!existing || existing.jobType !== JobType.BENCHMARK) {
      this.logger.warn({
        event: 'benchmark_worker_missing_job',
        jobId: payload.jobId,
      });
      return;
    }

    let job = existing;
    const { profile, target, context } = payload.body;
    const sessionId = payload.sessionId ?? job.sessionId;

    if (!sessionId) {
      job = await this.failTerminal(
        job,
        JobFailureReason.VALIDATION_ERROR,
        'Benchmark job is missing session identity.',
      );
      await this.publishTerminal(job, profile);
      this.emitFinished(job, profile);
      return;
    }

    try {
      await this.getExperimentSession.execute(sessionId);
    } catch {
      job = await this.failTerminal(
        job,
        JobFailureReason.SESSION_UNAVAILABLE,
        'Experiment session is no longer available.',
      );
      await this.publishTerminal(job, profile);
      this.emitFinished(job, profile);
      return;
    }

    job = await this.jobStore.markRunning(job);
    await this.publishRunning(job, profile);

    const result = await this.k6Executor.execute({
      rps: profile.rps,
      durationSeconds: profile.durationSeconds,
      sessionId,
      target,
      context,
      onProgress: async (sample) => {
        await this.publishInterim(job, profile, sample);
      },
    });

    if (result.success && result.summary) {
      const withSummary: BackgroundJob = {
        ...job,
        payloadSummary: {
          ...job.payloadSummary,
          k6Summary: result.summary,
        },
      };
      job = await this.jobStore.markCompleted(withSummary);
      await this.publishTerminal(job, profile);
      this.emitFinished(job, profile);
      return;
    }

    const message =
      result.stderr?.slice(0, 300) ??
      'Benchmark load test failed to complete successfully.';

    if (job.attemptCount >= job.maxAttempts) {
      job = await this.failTerminal(
        job,
        JobFailureReason.EXECUTION_ERROR,
        message,
      );
      await this.publishTerminal(job, profile);
      this.emitFinished(job, profile);
      return;
    }

    // Keep RUNNING so session inflight limits still apply while BullMQ retries.
    this.logger.warn({
      event: 'benchmark_worker_retrying',
      jobId: job.id,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      message,
    });
    throw new Error(message);
  }

  private async publishRunning(
    job: BackgroundJob,
    profile: BenchmarkProfile,
  ): Promise<void> {
    const startedAt = job.startedAt
      ? new Date(job.startedAt).getTime()
      : Date.now();
    const snapshot: BenchmarkProgressSnapshot = {
      jobId: job.id,
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: Math.max(Date.now() - startedAt, 0),
      elapsedBasis: 'execution',
      currentRps: null,
      provisional: true,
      terminal: false,
      profile,
      updatedAt: new Date().toISOString(),
    };
    await this.progressStore.saveAndPublish(snapshot);
  }

  private async publishInterim(
    job: BackgroundJob,
    profile: BenchmarkProfile,
    sample: Record<string, unknown>,
  ): Promise<void> {
    const mapped = this.progressMapper.map(sample);
    const startedAt = job.startedAt
      ? new Date(job.startedAt).getTime()
      : Date.now();
    const snapshot: BenchmarkProgressSnapshot = {
      jobId: job.id,
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: Math.max(Date.now() - startedAt, 0),
      elapsedBasis: 'execution',
      currentRps: mapped.currentRps,
      partialMetrics:
        mapped.partialMetrics.length > 0 ? mapped.partialMetrics : undefined,
      provisional: true,
      terminal: false,
      profile,
      updatedAt: new Date().toISOString(),
    };
    await this.progressStore.saveAndPublish(snapshot);
  }

  private async publishTerminal(
    job: BackgroundJob,
    profile: BenchmarkProfile,
  ): Promise<void> {
    const phase =
      job.status === JobStatus.COMPLETED
        ? BenchmarkJobStatus.COMPLETED
        : job.status === JobStatus.CANCELLED
          ? BenchmarkJobStatus.CANCELLED
          : BenchmarkJobStatus.FAILED;
    const end = job.completedAt
      ? new Date(job.completedAt).getTime()
      : Date.now();
    const start = job.startedAt
      ? new Date(job.startedAt).getTime()
      : new Date(job.createdAt).getTime();

    const snapshot: BenchmarkProgressSnapshot = {
      jobId: job.id,
      phase,
      elapsedMs: Math.max(end - start, 0),
      elapsedBasis: job.startedAt ? 'execution' : 'queue',
      provisional: true,
      terminal: true,
      profile,
      updatedAt: new Date().toISOString(),
      hint: 'Benchmark finished. Use status or metrics APIs for final results.',
    };
    await this.progressStore.saveAndPublish(snapshot);
  }

  private async failTerminal(
    job: BackgroundJob,
    reason: JobFailureReason,
    message: string,
  ): Promise<BackgroundJob> {
    const failed = await this.jobStore.markFailed(job, reason, message, {
      deadLetter: true,
    });
    this.deadLetterLogger.emitFromJob(failed, reason);
    return failed;
  }

  private emitFinished(job: BackgroundJob, profile: BenchmarkProfile): void {
    if (
      job.status !== JobStatus.COMPLETED &&
      job.status !== JobStatus.FAILED
    ) {
      return;
    }

    const event: BenchmarkFinishedEvent = {
      jobId: job.id,
      sessionId: job.sessionId ?? '',
      userId: job.userId,
      status:
        job.status === JobStatus.COMPLETED
          ? BenchmarkJobStatus.COMPLETED
          : BenchmarkJobStatus.FAILED,
      profile,
      k6Summary: job.payloadSummary?.k6Summary as
        | Record<string, unknown>
        | undefined,
      failureReason: job.failureReason,
    };

    this.eventEmitter.emit(BENCHMARK_FINISHED_EVENT, event);

    this.logger.log({
      event: 'benchmark_finished',
      jobId: job.id,
      sessionId: job.sessionId,
      status: job.status,
    });
  }
}
