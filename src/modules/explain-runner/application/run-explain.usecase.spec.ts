import {
  DatasetReadinessStatus,
  DatasetTier,
  ErrorCode,
  ExplainMode,
  SqlStatementKind,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetDatasetMetadataUseCase } from '../../dataset-loader/application/get-dataset-metadata.usecase';
import { ExecuteSandboxedSqlUseCase } from '../../sql-sandbox/application/execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { MetricsEnrichmentService } from '../../metrics-pipeline/application/metrics-enrichment.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';
import { RunExplainUseCase } from './run-explain.usecase';

describe('RunExplainUseCase', () => {
  const readyMetadata = {
    family: 'commerce',
    familyLabel: 'Commerce',
    version: 'v1',
    tier: DatasetTier.TIER_100K,
    status: DatasetReadinessStatus.READY,
    tables: [],
  };

  const samplePlanJson = JSON.stringify([
    {
      Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'users',
        'Startup Cost': 0,
        'Total Cost': 100,
        'Plan Rows': 1000,
      },
      'Planning Time': 0.1,
      'Execution Time': 0.5,
    },
  ]);

  let getDatasetMetadata: jest.Mocked<GetDatasetMetadataUseCase>;
  let executeSandboxedSql: jest.Mocked<ExecuteSandboxedSqlUseCase>;
  let validateSql: jest.Mocked<ValidateSqlStatementService>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let metricsEnrichment: jest.Mocked<MetricsEnrichmentService>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let useCase: RunExplainUseCase;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const baseInput = {
    sql: 'SELECT count(*) FROM users',
    parameters: [],
    explainMode: ExplainMode.EXPLAIN,
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
    context: {
      requestId: 'req-1',
      trackSlug: 'database-sql',
      labSlug: 'explain-analyze',
      userId: 'user-1',
    },
  };

  beforeEach(() => {
    getDatasetMetadata = {
      execute: jest.fn().mockResolvedValue(readyMetadata),
    } as unknown as jest.Mocked<GetDatasetMetadataUseCase>;

    executeSandboxedSql = {
      execute: jest.fn().mockResolvedValue({
        rows: [{ 'QUERY PLAN': samplePlanJson }],
        rowCount: 1,
        truncated: false,
        executionTimeMs: 15,
      }),
    } as unknown as jest.Mocked<ExecuteSandboxedSqlUseCase>;

    validateSql = {
      validate: jest.fn().mockReturnValue({
        valid: true,
        normalizedSql: 'EXPLAIN (FORMAT JSON) SELECT count(*) FROM users',
        statementKind: SqlStatementKind.EXPLAIN,
      }),
    } as unknown as jest.Mocked<ValidateSqlStatementService>;

    getExperimentSession = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    metricsEnrichment = {
      enrichExplainResult: jest.fn().mockImplementation(async (result) => ({
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

    useCase = new RunExplainUseCase(
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

  it('returns structured plan when dataset is ready', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.plan.nodeType).toBe('Seq Scan');
    expect(result.plan.relationName).toBe('users');
    expect(result.executionTimeMs).toBe(15);
    expect(result.explainMode).toBe(ExplainMode.EXPLAIN);
    expect(result.statementKind).toBe(ExplainMode.EXPLAIN);
    expect(result.rawPlanText).toBe(samplePlanJson);
    expect(executeSandboxedSql.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: 'EXPLAIN (FORMAT JSON) SELECT count(*) FROM users',
        parameters: [],
      }),
    );
  });

  it('wraps SQL with EXPLAIN ANALYZE when mode is explain_analyze', async () => {
    validateSql.validate.mockReturnValue({
      valid: true,
      normalizedSql:
        'EXPLAIN (ANALYZE, FORMAT JSON) SELECT count(*) FROM users',
      statementKind: SqlStatementKind.EXPLAIN_ANALYZE,
    });

    await useCase.execute({
      ...baseInput,
      explainMode: ExplainMode.EXPLAIN_ANALYZE,
    });

    expect(executeSandboxedSql.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: 'EXPLAIN (ANALYZE, FORMAT JSON) SELECT count(*) FROM users',
      }),
    );
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
        hint: 'Prepare the dataset before running EXPLAIN.',
      },
    });

    expect(executeSandboxedSql.execute).not.toHaveBeenCalled();
  });

  it('rejects SQL that already includes EXPLAIN prefix', async () => {
    await expect(
      useCase.execute({
        ...baseInput,
        sql: 'EXPLAIN SELECT 1',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: {
        reason: 'EXPLAIN_PREFIX_NOT_ALLOWED',
      },
    });
  });

  it('passes through sandbox errors unchanged', async () => {
    const sandboxError = new DomainError(
      ErrorCode.SANDBOX_ERROR,
      'Blocked statement',
      403,
      { violationCode: 'BLOCKED_PATTERN' },
    );
    executeSandboxedSql.execute.mockRejectedValue(sandboxError);

    await expect(useCase.execute(baseInput)).rejects.toBe(sandboxError);
  });

  it('emits explain audit logs without SQL text', async () => {
    await useCase.execute(baseInput);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'explain_sql_run',
        phase: 'started',
        explainMode: ExplainMode.EXPLAIN,
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'explain_sql_run',
        phase: 'completed',
        topLevelNodeType: 'Seq Scan',
      }),
    );
    expect(logSpy.mock.calls[0][0]).not.toHaveProperty('sql');
  });

  it('emits failure audit log on not-ready dataset', async () => {
    getDatasetMetadata.execute.mockResolvedValue({
      ...readyMetadata,
      status: DatasetReadinessStatus.PREPARING,
    });

    await expect(useCase.execute(baseInput)).rejects.toThrow(DomainError);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'explain_sql_run',
        phase: 'failed',
      }),
    );
  });
});
