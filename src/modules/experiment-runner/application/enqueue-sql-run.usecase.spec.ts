import { ConfigService } from '@nestjs/config';
import {
  DatasetTier,
  ErrorCode,
  ExperimentSessionStatus,
  JobStatus,
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
import { EnqueueSqlRunUseCase } from './enqueue-sql-run.usecase';

describe('EnqueueSqlRunUseCase', () => {
  const readySession = {
    sessionId: 'session-1',
    clientSessionToken: 'token',
    status: ExperimentSessionStatus.READY,
    trackSlug: 'database-sql',
    labSlug: 'index-playground',
    runtimeAdapter: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    schemaName: 'exp_test',
    dataset: { family: 'commerce', tier: DatasetTier.TIER_100K, version: 'v1' },
    createdAt: '2026-07-08T00:00:00.000Z',
    lastActivityAt: '2026-07-08T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };

  let validateSql: jest.Mocked<ValidateSqlStatementService>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let jobStore: jest.Mocked<JobStore>;
  let enqueueJobService: jest.Mocked<EnqueueJobService>;
  let useCase: EnqueueSqlRunUseCase;

  const baseInput = {
    sessionId: 'session-1',
    sql: 'SELECT id FROM users WHERE id = $1',
    parameters: [1] as unknown[],
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
    context: { userId: 'user-1' },
  };

  beforeEach(() => {
    validateSql = {
      validate: jest.fn().mockReturnValue({
        valid: true,
        normalizedSql: baseInput.sql,
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
          jobType: JobType.SQL_EXECUTION,
          status: JobStatus.QUEUED,
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

    useCase = new EnqueueSqlRunUseCase(
      validateSql,
      getExperimentSession,
      rateLimitService,
      jobStore,
      enqueueJobService,
      configService,
    );
  });

  it('validates, enqueues, and returns a queued job without executing', async () => {
    const result = await useCase.execute(baseInput);

    expect(validateSql.validate).toHaveBeenCalledWith(baseInput.sql, [1]);
    expect(result.status).toBe(JobStatus.QUEUED);
    expect(result.jobType).toBe(JobType.SQL_EXECUTION);
    expect(result.jobId).toBe('job-1');
    expect(enqueueJobService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: JobType.SQL_EXECUTION,
        userId: 'user-1',
        sessionId: 'session-1',
        body: expect.objectContaining({
          sql: baseInput.sql,
          parameters: [1],
          context: expect.objectContaining({ preAuthorized: true }),
        }),
        payloadSummary: expect.objectContaining({
          statementKind: SqlStatementKind.SELECT,
          datasetFamily: 'commerce',
          datasetTier: DatasetTier.TIER_100K,
        }),
      }),
    );
    expect(rateLimitService.consumeQuota).toHaveBeenCalledWith({
      operation: RateLimitOperation.SQL_RUN,
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

  it('rejects with SQL_RUN_INFLIGHT_LIMIT when a run is already in flight', async () => {
    jobStore.countInflightBySession.mockResolvedValue(1);

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      details: expect.objectContaining({ reason: 'SQL_RUN_INFLIGHT_LIMIT' }),
    });
    expect(jobStore.countInflightBySession).toHaveBeenCalledWith(
      'session-1',
      JobType.SQL_EXECUTION,
    );
    expect(rateLimitService.consumeQuota).not.toHaveBeenCalled();
    expect(enqueueJobService.enqueue).not.toHaveBeenCalled();
  });

  it('propagates validation failures without creating a job', async () => {
    validateSql.validate.mockImplementation(() => {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'blocked', 400);
    });

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
    expect(enqueueJobService.enqueue).not.toHaveBeenCalled();
  });
});
