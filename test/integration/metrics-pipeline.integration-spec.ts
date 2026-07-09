import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { DatasetLoaderModule } from '../../src/modules/dataset-loader/dataset-loader.module';
import { SqlSandboxModule } from '../../src/modules/sql-sandbox/sql-sandbox.module';
import { ExperimentRunnerModule } from '../../src/modules/experiment-runner/experiment-runner.module';
import { ExplainRunnerModule } from '../../src/modules/explain-runner/explain-runner.module';
import { ExperimentIsolationModule } from '../../src/modules/experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../../src/modules/metrics-pipeline/metrics-pipeline.module';
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { ProvisionExperimentSessionUseCase } from '../../src/modules/experiment-isolation/application/provision-experiment-session.usecase';
import { RunExperimentSqlUseCase } from '../../src/modules/experiment-runner/application/run-experiment-sql.usecase';
import { RunExplainUseCase } from '../../src/modules/explain-runner/application/run-explain.usecase';
import { GetMetricHistoryUseCase } from '../../src/modules/metrics-pipeline/application/get-metric-history.usecase';
import { RedisModule } from '../../src/common/services/redis.module';
import { DatasetTier, ExplainMode } from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra = playgroundConfigured && redisConfigured && platformConfigured
  ? describe
  : describe.skip;

const DATABASE_MVP_METRIC_KEYS = [
  'execution_time_ms',
  'rows_returned',
  'rows_scanned',
  'index_scan_used',
  'seq_scan_used',
  'planning_time_ms',
  'plan_total_cost',
  'plan_execution_time_ms',
];

describeIfInfra('Metrics Pipeline (integration)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let provisionSession: ProvisionExperimentSessionUseCase;
  let runExperimentSql: RunExperimentSqlUseCase;
  let runExplain: RunExplainUseCase;
  let getMetricHistory: GetMetricHistoryUseCase;
  let sessionId: string;
  const labSlug = 'index-playground';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        PlatformDatabaseModule,
        PlaygroundDatabaseModule,
        RedisModule,
        ExperimentIsolationModule,
        DatasetLoaderModule,
        SqlSandboxModule,
        MetricsPipelineModule,
        ExperimentRunnerModule,
        ExplainRunnerModule,
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    provisionSession = moduleRef.get(ProvisionExperimentSessionUseCase);
    runExperimentSql = moduleRef.get(RunExperimentSqlUseCase);
    runExplain = moduleRef.get(RunExplainUseCase);
    getMetricHistory = moduleRef.get(GetMetricHistoryUseCase);

    const session = await provisionSession.execute({
      clientSessionToken: `metrics-session-${Date.now()}`,
      trackSlug: 'database-sql',
      labSlug,
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      },
    });
    sessionId = session.sessionId;

    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
      sessionId,
    });
  }, 120_000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await moduleRef.close();
  });

  it(
    'returns inline metrics on SQL execution',
    async () => {
      const result = await runExperimentSql.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: {
          trackSlug: 'database-sql',
          labSlug,
        },
        sessionId,
      });

      expect(result.metrics).toBeDefined();
      expect(result.runId).toBeDefined();
      expect(result.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'execution_time_ms' }),
          expect.objectContaining({ key: 'rows_returned' }),
        ]),
      );
    },
    60_000,
  );

  it(
    'returns plan-derived metrics on EXPLAIN ANALYZE',
    async () => {
      const result = await runExplain.execute({
        sql: 'SELECT count(*) FROM users',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN_ANALYZE,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: {
          trackSlug: 'database-sql',
          labSlug,
        },
        sessionId,
      });

      expect(result.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'rows_scanned' }),
          expect.objectContaining({ key: 'plan_total_cost' }),
          expect.objectContaining({ key: 'planning_time_ms' }),
        ]),
      );
    },
    60_000,
  );

  it(
    'returns metric history for before/after comparison',
    async () => {
      const history = await getMetricHistory.execute({
        sessionId,
        labSlug,
      });

      expect(history.snapshots.length).toBeGreaterThanOrEqual(2);
      expect(history.retentionLimit).toBeGreaterThan(0);
      expect(history.snapshots[0].createdAt <= history.snapshots[1].createdAt).toBe(
        true,
      );
    },
    30_000,
  );

  it(
    'includes all MVP catalog keys across execution and explain flows',
    async () => {
      const executionResult = await runExperimentSql.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: { trackSlug: 'database-sql', labSlug },
        sessionId,
      });

      const explainResult = await runExplain.execute({
        sql: 'SELECT count(*) FROM users',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN_ANALYZE,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: { trackSlug: 'database-sql', labSlug },
        sessionId,
      });

      const keys = new Set([
        ...(executionResult.metrics ?? []).map((metric) => metric.key),
        ...(explainResult.metrics ?? []).map((metric) => metric.key),
      ]);

      for (const key of DATABASE_MVP_METRIC_KEYS) {
        expect(keys.has(key)).toBe(true);
      }
    },
    120_000,
  );
});
