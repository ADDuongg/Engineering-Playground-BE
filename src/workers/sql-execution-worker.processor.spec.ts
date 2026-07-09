import { ConfigService } from '@nestjs/config';
import {
  BackgroundJob,
  DatasetTier,
  ErrorCode,
  JobFailureReason,
  JobQueuePayload,
  JobStatus,
  JobType,
  SandboxViolationCode,
  SqlExecutionJobBody,
  SqlStatementKind,
} from '@db-play/types';
import { Job } from 'bullmq';
import { DomainError } from '../common/errors/domain.error';
import { RunExperimentSqlUseCase } from '../modules/experiment-runner/application/run-experiment-sql.usecase';
import { DeadLetterLogger } from '../modules/worker-queue/infrastructure/dead-letter.logger';
import { JobStore } from '../modules/worker-queue/infrastructure/job.store';
import { SqlExecutionWorkerProcessor } from './sql-execution-worker.processor';

const workerCtor = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((...args: unknown[]) => {
    workerCtor(...args);
    return { on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
  }),
}));

function buildJob(overrides: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    id: 'job-1',
    jobType: JobType.SQL_EXECUTION,
    userId: 'user-1',
    sessionId: 'session-1',
    status: JobStatus.QUEUED,
    payloadSummary: { statementKind: SqlStatementKind.SELECT },
    createdAt: '2026-07-08T00:00:00.000Z',
    attemptCount: 0,
    maxAttempts: 2,
    ...overrides,
  };
}

function buildBullJob(): Job<JobQueuePayload<SqlExecutionJobBody>> {
  return {
    data: {
      jobId: 'job-1',
      jobType: JobType.SQL_EXECUTION,
      sessionId: 'session-1',
      userId: 'user-1',
      body: {
        sql: 'SELECT 1',
        parameters: [],
        dataset: { family: 'commerce', tier: DatasetTier.TIER_100K, version: 'v1' },
        context: { userId: 'user-1' },
      },
    },
  } as unknown as Job<JobQueuePayload<SqlExecutionJobBody>>;
}

describe('SqlExecutionWorkerProcessor', () => {
  let configService: ConfigService;
  let jobStore: jest.Mocked<JobStore>;
  let runExperimentSql: jest.Mocked<RunExperimentSqlUseCase>;
  let deadLetterLogger: jest.Mocked<DeadLetterLogger>;
  let processor: SqlExecutionWorkerProcessor;

  const runResult = {
    rows: [{ n: 1 }],
    rowCount: 1,
    truncated: false,
    executionTimeMs: 5,
    dataset: { family: 'commerce', tier: DatasetTier.TIER_100K, version: 'v1' },
    statementKind: SqlStatementKind.SELECT,
    metrics: [],
    runId: 'run-1',
  };

  beforeEach(() => {
    workerCtor.mockReset();

    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          'sqlExecution.queueName': 'sql-execution-jobs',
          'sqlExecution.workerConcurrency': 5,
          'sqlExecution.jobTimeoutSeconds': 60,
          'redis.host': 'localhost',
          'redis.port': 6379,
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    jobStore = {
      getById: jest.fn().mockResolvedValue(buildJob()),
      markRunning: jest
        .fn()
        .mockImplementation((job: BackgroundJob) =>
          Promise.resolve({
            ...job,
            status: JobStatus.RUNNING,
            attemptCount: job.attemptCount + 1,
            startedAt: '2026-07-08T00:00:01.000Z',
          }),
        ),
      markCompleted: jest
        .fn()
        .mockImplementation((job: BackgroundJob) =>
          Promise.resolve({ ...job, status: JobStatus.COMPLETED }),
        ),
      markFailed: jest
        .fn()
        .mockImplementation(
          (job: BackgroundJob, reason: JobFailureReason, message: string) =>
            Promise.resolve({
              ...job,
              status: JobStatus.FAILED,
              failureReason: reason,
              failureMessage: message,
            }),
        ),
    } as unknown as jest.Mocked<JobStore>;

    runExperimentSql = {
      execute: jest.fn().mockResolvedValue(runResult),
    } as unknown as jest.Mocked<RunExperimentSqlUseCase>;

    deadLetterLogger = {
      emitFromJob: jest.fn(),
    } as unknown as jest.Mocked<DeadLetterLogger>;

    processor = new SqlExecutionWorkerProcessor(
      configService,
      jobStore,
      runExperimentSql,
      deadLetterLogger,
    );
  });

  it('executes the run and stores the embedded result on completion', async () => {
    await processor.processJob(buildBullJob());

    expect(jobStore.markRunning).toHaveBeenCalled();
    expect(runExperimentSql.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: 'SELECT 1',
        sessionId: 'session-1',
        context: expect.objectContaining({ preAuthorized: true }),
      }),
    );
    const completedArg = jobStore.markCompleted.mock.calls[0][0];
    expect(completedArg.payloadSummary?.executionResult).toEqual(runResult);
  });

  it('skips a cancelled job without executing', async () => {
    jobStore.getById.mockResolvedValue(buildJob({ status: JobStatus.CANCELLED }));

    await processor.processJob(buildBullJob());

    expect(jobStore.markRunning).not.toHaveBeenCalled();
    expect(runExperimentSql.execute).not.toHaveBeenCalled();
  });

  it('maps sandbox timeout to a terminal TIMEOUT failure without retrying', async () => {
    runExperimentSql.execute.mockRejectedValue(
      new DomainError(ErrorCode.TIMEOUT, 'too slow', 408, {
        violationCode: SandboxViolationCode.QUERY_TIMEOUT,
      }),
    );

    await expect(processor.processJob(buildBullJob())).resolves.toBeUndefined();

    expect(jobStore.markFailed).toHaveBeenCalledWith(
      expect.anything(),
      JobFailureReason.TIMEOUT,
      expect.any(String),
      expect.objectContaining({ deadLetter: false }),
    );
  });

  it('does not retry deterministic validation failures', async () => {
    runExperimentSql.execute.mockRejectedValue(
      new DomainError(ErrorCode.VALIDATION_ERROR, 'blocked', 400),
    );

    await expect(processor.processJob(buildBullJob())).resolves.toBeUndefined();
    expect(jobStore.markFailed).toHaveBeenCalledWith(
      expect.anything(),
      JobFailureReason.VALIDATION_ERROR,
      expect.any(String),
      expect.objectContaining({ deadLetter: false }),
    );
  });

  it('retries transient errors until attempts are exhausted then dead-letters', async () => {
    runExperimentSql.execute.mockRejectedValue(new Error('connection reset'));

    // First attempt: attemptCount becomes 1 (< 2) → rethrow for BullMQ retry
    jobStore.getById.mockResolvedValue(buildJob({ attemptCount: 0 }));
    await expect(processor.processJob(buildBullJob())).rejects.toThrow(
      'connection reset',
    );
    expect(deadLetterLogger.emitFromJob).not.toHaveBeenCalled();

    // Final attempt: attemptCount becomes 2 (>= 2) → dead-letter, no rethrow
    jobStore.getById.mockResolvedValue(buildJob({ attemptCount: 1 }));
    await expect(processor.processJob(buildBullJob())).resolves.toBeUndefined();
    expect(deadLetterLogger.emitFromJob).toHaveBeenCalledWith(
      expect.anything(),
      JobFailureReason.EXECUTION_ERROR,
    );
  });

  it('constructs the worker with configured concurrency and lock duration', () => {
    processor.onModuleInit();

    expect(workerCtor).toHaveBeenCalledWith(
      'sql-execution-jobs',
      expect.any(Function),
      expect.objectContaining({ concurrency: 5, lockDuration: 60_000 }),
    );
  });
});
