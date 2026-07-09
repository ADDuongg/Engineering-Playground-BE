import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BenchmarkJobStatus,
  BenchmarkProgressSnapshot,
  EnqueueBenchmarkInput,
  EnqueueBenchmarkResult,
  ErrorCode,
  ExperimentSessionStatus,
  JobType,
  RateLimitOperation,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';
import { EnqueueJobService } from '../../worker-queue/application/enqueue-job.service';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { BenchmarkProfileValidator } from '../infrastructure/benchmark-profile.validator';
import { BenchmarkProgressStore } from '../infrastructure/benchmark-progress.store';

@Injectable()
export class EnqueueBenchmarkUseCase {
  private readonly logger = new Logger(EnqueueBenchmarkUseCase.name);

  constructor(
    private readonly profileValidator: BenchmarkProfileValidator,
    private readonly validateSql: ValidateSqlStatementService,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly rateLimitService: RateLimitService,
    private readonly jobStore: JobStore,
    private readonly enqueueJobService: EnqueueJobService,
    private readonly configService: ConfigService,
    private readonly progressStore: BenchmarkProgressStore,
  ) {}

  async execute(input: EnqueueBenchmarkInput): Promise<EnqueueBenchmarkResult> {
    const profile = this.profileValidator.validate(input.profile);

    const sql = input.target.sql?.trim() ?? '';
    if (!sql) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Benchmark target SQL is required.',
        400,
        {
          reason: 'EMPTY_BENCHMARK_SQL',
          hint: 'Enter a SELECT statement in the Target SQL editor before starting the benchmark.',
        },
      );
    }

    this.validateSql.validate(sql, input.target.parameters ?? []);

    const session = await this.getExperimentSession.execute(input.sessionId);

    if (session.status !== ExperimentSessionStatus.READY) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Experiment session is not available for benchmarking.',
        404,
        {
          reason: 'SESSION_UNAVAILABLE',
          hint: 'Open the lab and wait for the experiment session to be ready before starting a benchmark.',
        },
      );
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Experiment session has expired.',
        404,
        {
          reason: 'SESSION_UNAVAILABLE',
          hint: 'Open the lab again to start a new experiment session.',
        },
      );
    }

    const maxInflight = this.configService.get<number>(
      'benchmark.maxInflightPerSession',
      1,
    );
    const inflight = await this.jobStore.countInflightBySession(
      input.sessionId,
      JobType.BENCHMARK,
    );

    if (inflight >= maxInflight) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'A benchmark is already running for this experiment session.',
        409,
        {
          reason: 'BENCHMARK_INFLIGHT_LIMIT',
          hint: 'Wait for the current benchmark to finish or check its status before starting another.',
        },
      );
    }

    await this.rateLimitService.consumeQuota({
      operation: RateLimitOperation.BENCHMARK_ENQUEUE,
      userId: input.context?.userId,
      sessionId: input.sessionId,
    });

    const target = {
      sql,
      parameters: input.target.parameters ?? [],
      dataset: {
        family: input.target.dataset.family,
        tier: input.target.dataset.tier,
        version: input.target.dataset.version ?? 'v1',
      },
    };

    const { job } = await this.enqueueJobService.enqueue({
      jobType: JobType.BENCHMARK,
      userId: input.context?.userId ?? null,
      sessionId: input.sessionId,
      body: {
        profile,
        target,
        context: input.context,
      },
      payloadSummary: {
        profile,
        dataset: target.dataset,
        context: input.context,
        metricsStatus: 'pending',
      },
    });

    const queuedSnapshot: BenchmarkProgressSnapshot = {
      jobId: job.id,
      phase: BenchmarkJobStatus.QUEUED,
      elapsedMs: 0,
      elapsedBasis: 'queue',
      currentRps: null,
      provisional: true,
      terminal: false,
      profile,
      updatedAt: new Date().toISOString(),
      hint: 'Benchmark is waiting in the queue.',
    };
    await this.progressStore.saveAndPublish(queuedSnapshot);

    this.logger.log({
      event: 'benchmark_enqueued',
      jobId: job.id,
      sessionId: input.sessionId,
      rps: profile.rps,
      durationSeconds: profile.durationSeconds,
    });

    return {
      jobId: job.id,
      status: BenchmarkJobStatus.QUEUED,
      profile,
      createdAt: job.createdAt,
    };
  }
}
