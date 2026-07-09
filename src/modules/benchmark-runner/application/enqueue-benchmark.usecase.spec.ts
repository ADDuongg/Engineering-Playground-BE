import {
  BenchmarkJobStatus,
  DatasetTier,
  ErrorCode,
  ExperimentSessionStatus,
  JobType,
  RateLimitOperation,
  RuntimeAdapterType,
  SqlStatementKind,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';
import { EnqueueJobService } from '../../worker-queue/application/enqueue-job.service';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { BenchmarkProfileValidator } from '../infrastructure/benchmark-profile.validator';
import { BenchmarkProgressStore } from '../infrastructure/benchmark-progress.store';
import { EnqueueBenchmarkUseCase } from './enqueue-benchmark.usecase';
import { ConfigService } from '@nestjs/config';

describe('EnqueueBenchmarkUseCase', () => {
  const readySession = {
    sessionId: 'session-1',
    clientSessionToken: 'token',
    status: ExperimentSessionStatus.READY,
    trackSlug: 'database-sql',
    labSlug: 'benchmark-lab',
    runtimeAdapter: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    schemaName: 'exp_test',
    dataset: { family: 'commerce', tier: DatasetTier.TIER_100K, version: 'v1' },
    createdAt: '2026-07-08T00:00:00.000Z',
    lastActivityAt: '2026-07-08T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };

  let profileValidator: jest.Mocked<BenchmarkProfileValidator>;
  let validateSql: jest.Mocked<ValidateSqlStatementService>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let jobStore: jest.Mocked<JobStore>;
  let enqueueJobService: jest.Mocked<EnqueueJobService>;
  let useCase: EnqueueBenchmarkUseCase;

  const baseInput = {
    sessionId: 'session-1',
    profile: { rps: 100, durationSeconds: 10 },
    target: {
      sql: 'SELECT id FROM users LIMIT 10',
      parameters: [] as unknown[],
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      },
    },
    context: { userId: 'user-1' },
  };

  beforeEach(() => {
    profileValidator = {
      validate: jest.fn().mockImplementation((profile) => profile),
    } as unknown as jest.Mocked<BenchmarkProfileValidator>;

    validateSql = {
      validate: jest.fn().mockReturnValue({
        valid: true,
        normalizedSql: baseInput.target.sql,
        statementKind: SqlStatementKind.SELECT,
      }),
    } as unknown as jest.Mocked<ValidateSqlStatementService>;

    getExperimentSession = {
      execute: jest.fn().mockResolvedValue(readySession),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    rateLimitService = {
      consumeQuota: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RateLimitService>;

    jobStore = {
      countInflightBySession: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<JobStore>;

    enqueueJobService = {
      enqueue: jest.fn().mockResolvedValue({
        job: {
          id: 'job-1',
          jobType: JobType.BENCHMARK,
          status: BenchmarkJobStatus.QUEUED,
          createdAt: '2026-07-08T00:00:00.000Z',
          attemptCount: 0,
          maxAttempts: 2,
          userId: 'user-1',
          sessionId: 'session-1',
        },
      }),
    } as unknown as jest.Mocked<EnqueueJobService>;

    const configService = {
      get: jest.fn().mockReturnValue(1),
    } as unknown as ConfigService;

    const progressStore = {
      saveAndPublish: jest.fn().mockResolvedValue(undefined),
    } as unknown as BenchmarkProgressStore;

    useCase = new EnqueueBenchmarkUseCase(
      profileValidator,
      validateSql,
      getExperimentSession,
      rateLimitService,
      jobStore,
      enqueueJobService,
      configService,
      progressStore,
    );
  });

  it('returns queued job without waiting for execution', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.status).toBe(BenchmarkJobStatus.QUEUED);
    expect(result.jobId).toBe('job-1');
    expect(enqueueJobService.enqueue).toHaveBeenCalledWith({
      jobType: JobType.BENCHMARK,
      userId: 'user-1',
      sessionId: 'session-1',
      body: {
        profile: baseInput.profile,
        target: baseInput.target,
        context: baseInput.context,
      },
      payloadSummary: {
        profile: baseInput.profile,
        dataset: baseInput.target.dataset,
        context: baseInput.context,
        metricsStatus: 'pending',
      },
    });
    expect(jobStore.countInflightBySession).toHaveBeenCalledWith(
      'session-1',
      JobType.BENCHMARK,
    );
    expect(rateLimitService.consumeQuota).toHaveBeenCalledWith({
      operation: RateLimitOperation.BENCHMARK_ENQUEUE,
      userId: 'user-1',
      sessionId: 'session-1',
    });
  });

  it('rejects when session is unavailable', async () => {
    getExperimentSession.execute.mockRejectedValue(
      new DomainError(ErrorCode.NOT_FOUND, 'missing', 404),
    );

    await expect(useCase.execute(baseInput)).rejects.toThrow(DomainError);
    expect(enqueueJobService.enqueue).not.toHaveBeenCalled();
  });

  it('rejects when inflight limit is reached', async () => {
    jobStore.countInflightBySession.mockResolvedValue(1);

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
    expect(rateLimitService.consumeQuota).not.toHaveBeenCalled();
  });
});
