import {
  DatasetReadinessStatus,
  DatasetTier,
  ErrorCode,
  SandboxViolationCode,
  SqlStatementKind,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetDatasetMetadataUseCase } from '../../dataset-loader/application/get-dataset-metadata.usecase';
import { ExecuteSandboxedSqlUseCase } from '../../sql-sandbox/application/execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { MetricsEnrichmentService } from '../../metrics-pipeline/application/metrics-enrichment.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';
import { RunExperimentSqlUseCase } from './run-experiment-sql.usecase';

describe('RunExperimentSqlUseCase', () => {
  const readyMetadata = {
    family: 'commerce',
    familyLabel: 'Commerce',
    version: 'v1',
    tier: DatasetTier.TIER_100K,
    status: DatasetReadinessStatus.READY,
    tables: [],
  };

  let getDatasetMetadata: jest.Mocked<GetDatasetMetadataUseCase>;
  let executeSandboxedSql: jest.Mocked<ExecuteSandboxedSqlUseCase>;
  let validateSql: jest.Mocked<ValidateSqlStatementService>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let metricsEnrichment: jest.Mocked<MetricsEnrichmentService>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let useCase: RunExperimentSqlUseCase;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const baseInput = {
    sql: 'SELECT * FROM users WHERE id = $1',
    parameters: [1],
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
    context: {
      requestId: 'req-1',
      trackSlug: 'database-sql',
      labSlug: 'index-playground',
      userId: 'user-1',
    },
  };

  beforeEach(() => {
    getDatasetMetadata = {
      execute: jest.fn().mockResolvedValue(readyMetadata),
    } as unknown as jest.Mocked<GetDatasetMetadataUseCase>;

    executeSandboxedSql = {
      execute: jest.fn().mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        truncated: false,
        executionTimeMs: 12,
      }),
    } as unknown as jest.Mocked<ExecuteSandboxedSqlUseCase>;

    validateSql = {
      validate: jest.fn().mockReturnValue({
        valid: true,
        normalizedSql: baseInput.sql,
        statementKind: SqlStatementKind.SELECT,
      }),
    } as unknown as jest.Mocked<ValidateSqlStatementService>;

    getExperimentSession = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    metricsEnrichment = {
      enrichExecutionResult: jest.fn().mockImplementation(async (result) => ({
        ...result,
        metrics: [
          {
            key: 'execution_time_ms',
            label: 'Execution Time',
            unit: 'ms',
            value: result.executionTimeMs,
            group: 'performance',
          },
        ],
        runId: 'run-1',
      })),
    } as unknown as jest.Mocked<MetricsEnrichmentService>;

    rateLimitService = {
      consumeQuota: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RateLimitService>;

    useCase = new RunExperimentSqlUseCase(
      getDatasetMetadata,
      executeSandboxedSql,
      validateSql,
      getExperimentSession,
      metricsEnrichment,
      rateLimitService,
    );

    logSpy = jest.spyOn(
      (useCase as unknown as { logger: { log: (payload: unknown) => void } })
        .logger,
      'log',
    );
    warnSpy = jest.spyOn(
      (useCase as unknown as { logger: { warn: (payload: unknown) => void } })
        .logger,
      'warn',
    );
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('returns structured results when dataset is ready', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.rows).toEqual([{ id: 1 }]);
    expect(result.rowCount).toBe(1);
    expect(result.executionTimeMs).toBe(12);
    expect(result.statementKind).toBe(SqlStatementKind.SELECT);
    expect(result.dataset).toEqual({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });
    expect(getDatasetMetadata.execute).toHaveBeenCalledWith(
      'commerce',
      DatasetTier.TIER_100K,
      'v1',
      undefined,
    );
    expect(executeSandboxedSql.execute).toHaveBeenCalledWith({
      sql: baseInput.sql,
      parameters: baseInput.parameters,
      sessionId: undefined,
      schemaName: undefined,
      context: baseInput.context,
    });
  });

  it('blocks execution when dataset is not ready', async () => {
    getDatasetMetadata.execute.mockResolvedValue({
      ...readyMetadata,
      status: DatasetReadinessStatus.NOT_STARTED,
    });

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.EXECUTION_ERROR,
      details: {
        reason: 'DATASET_NOT_READY',
        status: DatasetReadinessStatus.NOT_STARTED,
        hint: 'Prepare the dataset before running SQL.',
      },
    });

    expect(executeSandboxedSql.execute).not.toHaveBeenCalled();
  });

  it.each([
    [
      DatasetReadinessStatus.PREPARING,
      'Wait for dataset preparation to complete before running SQL.',
    ],
    [
      DatasetReadinessStatus.RESETTING,
      'Wait for dataset reset to complete before running SQL.',
    ],
    [
      DatasetReadinessStatus.FAILED,
      'Dataset preparation or reset failed. Retry prepare or reset before running SQL.',
    ],
  ])('returns status-specific hint for %s', async (status, hint) => {
    getDatasetMetadata.execute.mockResolvedValue({
      ...readyMetadata,
      status,
    });

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      details: {
        reason: 'DATASET_NOT_READY',
        status,
        hint,
      },
    });
  });

  it('passes through sandbox errors unchanged', async () => {
    const sandboxError = new DomainError(
      ErrorCode.SANDBOX_ERROR,
      'Blocked statement',
      403,
      {
        violationCode: SandboxViolationCode.BLOCKED_PATTERN,
        policyVersion: '1',
      },
    );
    executeSandboxedSql.execute.mockRejectedValue(sandboxError);

    await expect(useCase.execute(baseInput)).rejects.toBe(sandboxError);
  });

  it('forwards lab context to sandbox execution', async () => {
    await useCase.execute(baseInput);

    expect(executeSandboxedSql.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          requestId: 'req-1',
          trackSlug: 'database-sql',
          labSlug: 'index-playground',
          userId: 'user-1',
        },
      }),
    );
  });

  it('infers field metadata from rows when sandbox omits fields', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.fields).toEqual([{ name: 'id', dataTypeId: 0 }]);
  });

  it('emits audit logs for started and completed phases', async () => {
    await useCase.execute(baseInput);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'experiment_sql_run',
        phase: 'started',
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        labSlug: 'index-playground',
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'experiment_sql_run',
        phase: 'completed',
        rowCount: 1,
        statementKind: SqlStatementKind.SELECT,
      }),
    );
  });

  it('skips rate limit for authenticated internal benchmark load traffic', async () => {
    await useCase.execute({
      ...baseInput,
      context: {
        ...baseInput.context,
        benchmarkInternal: true,
      },
    });

    expect(rateLimitService.consumeQuota).not.toHaveBeenCalled();
    expect(executeSandboxedSql.execute).toHaveBeenCalled();
  });

  it('emits audit log on failure without SQL text', async () => {
    getDatasetMetadata.execute.mockResolvedValue({
      ...readyMetadata,
      status: DatasetReadinessStatus.PREPARING,
    });

    await expect(useCase.execute(baseInput)).rejects.toThrow(DomainError);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'experiment_sql_run',
        phase: 'failed',
        errorCode: ErrorCode.EXECUTION_ERROR,
      }),
    );
    expect(warnSpy.mock.calls[0][0]).not.toHaveProperty('sql');
    expect(warnSpy.mock.calls[0][0]).not.toHaveProperty('parameters');
  });
});
