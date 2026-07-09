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
import { ExplainRunnerModule } from '../../src/modules/explain-runner/explain-runner.module';
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { RunExplainUseCase } from '../../src/modules/explain-runner/application/run-explain.usecase';
import { DatasetPreparationStatusStore } from '../../src/modules/dataset-loader/infrastructure/dataset-preparation-status.store';
import { RedisModule } from '../../src/common/services/redis.module';
import {
  DatasetTier,
  ErrorCode,
  ExplainMode,
} from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra = playgroundConfigured && redisConfigured && platformConfigured
  ? describe
  : describe.skip;

describeIfInfra('Explain Runner (integration)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let runExplain: RunExplainUseCase;
  let statusStore: DatasetPreparationStatusStore;

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
        DatasetLoaderModule,
        SqlSandboxModule,
        ExplainRunnerModule,
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    runExplain = moduleRef.get(RunExplainUseCase);
    statusStore = moduleRef.get(DatasetPreparationStatusStore);
  }, 60_000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await moduleRef.close();
  });

  it('blocks explain when dataset is not ready', async () => {
    await statusStore.markPreparing('commerce', 'v1', DatasetTier.TIER_10M);

    await expect(
      runExplain.execute({
        sql: 'SELECT 1',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_10M,
          version: 'v1',
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.EXECUTION_ERROR,
      details: {
        reason: 'DATASET_NOT_READY',
        status: 'preparing',
      },
    });
  });

  it(
    'prepare → EXPLAIN → structured plan tree',
    async () => {
      await prepareDataset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });

      const result = await runExplain.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: {
          trackSlug: 'database-sql',
          labSlug: 'explain-analyze',
        },
      });

      expect(result.plan.nodeType).toBeTruthy();
      expect(result.plan.totalCost).toBeGreaterThanOrEqual(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.explainMode).toBe(ExplainMode.EXPLAIN);
      expect(result.statementKind).toBe(ExplainMode.EXPLAIN);
      expect(result.dataset).toEqual({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });
      expect(result.rawPlanText).toBeTruthy();
    },
    60_000,
  );

  it(
    'EXPLAIN ANALYZE returns planning time and actual row metrics',
    async () => {
      await prepareDataset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });

      const result = await runExplain.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN_ANALYZE,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      expect(result.statementKind).toBe(ExplainMode.EXPLAIN_ANALYZE);
      expect(result.planningTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.plan.actualRows).toBeDefined();
    },
    60_000,
  );

  it('blocks sandbox violations before explain execution', async () => {
    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    await expect(
      runExplain.execute({
        sql: 'DROP DATABASE playground_db',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.SANDBOX_ERROR,
    });
  });

  it('rejects SQL with EXPLAIN prefix in favor of explainMode', async () => {
    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    await expect(
      runExplain.execute({
        sql: 'EXPLAIN SELECT 1',
        parameters: [],
        explainMode: ExplainMode.EXPLAIN,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: {
        reason: 'EXPLAIN_PREFIX_NOT_ALLOWED',
      },
    });
  });

  if (platformConfigured) {
    it('does not modify platform database records', async () => {
      const platformDs = await import('typeorm').then(({ DataSource }) => {
        const ds = new DataSource({
          type: 'postgres',
          host: process.env.PLATFORM_DB_HOST,
          port: parseInt(process.env.PLATFORM_DB_PORT ?? '5432', 10),
          username: process.env.PLATFORM_DB_USER,
          password: process.env.PLATFORM_DB_PASSWORD,
          database: process.env.PLATFORM_DB_NAME,
        });
        return ds.initialize();
      });

      try {
        await prepareDataset.execute({
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        });

        const beforeRows = await platformDs.query(
          'SELECT COUNT(*)::text AS count FROM tracks',
        );
        const beforeCount = parseInt(
          (beforeRows as { count: string }[])[0]?.count ?? '0',
          10,
        );

        await runExplain.execute({
          sql: 'SELECT count(*)::int AS cnt FROM users',
          parameters: [],
          explainMode: ExplainMode.EXPLAIN,
          dataset: {
            family: 'commerce',
            tier: DatasetTier.TIER_100K,
            version: 'v1',
          },
        });

        const afterRows = await platformDs.query(
          'SELECT COUNT(*)::text AS count FROM tracks',
        );
        const afterCount = parseInt(
          (afterRows as { count: string }[])[0]?.count ?? '0',
          10,
        );

        expect(afterCount).toBe(beforeCount);
      } finally {
        await platformDs.destroy();
      }
    }, 60_000);
  }
});
