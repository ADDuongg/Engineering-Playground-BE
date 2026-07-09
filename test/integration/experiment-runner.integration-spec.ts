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
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { ResetDatasetUseCase } from '../../src/modules/dataset-loader/application/reset-dataset.usecase';
import { RunExperimentSqlUseCase } from '../../src/modules/experiment-runner/application/run-experiment-sql.usecase';
import { DatasetPreparationStatusStore } from '../../src/modules/dataset-loader/infrastructure/dataset-preparation-status.store';
import { RedisModule } from '../../src/common/services/redis.module';
import { DomainError } from '../../src/common/errors/domain.error';
import {
  DatasetTier,
  ErrorCode,
  SandboxViolationCode,
  SqlStatementKind,
} from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra = playgroundConfigured && redisConfigured && platformConfigured
  ? describe
  : describe.skip;

describeIfInfra('Experiment Runner (integration)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let resetDataset: ResetDatasetUseCase;
  let runExperimentSql: RunExperimentSqlUseCase;
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
        ExperimentRunnerModule,
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    resetDataset = moduleRef.get(ResetDatasetUseCase);
    runExperimentSql = moduleRef.get(RunExperimentSqlUseCase);
    statusStore = moduleRef.get(DatasetPreparationStatusStore);
  }, 60_000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await moduleRef.close();
  });

  it('blocks execution when dataset is not ready', async () => {
    await statusStore.markPreparing(
      'commerce',
      'v1',
      DatasetTier.TIER_10M,
    );

    await expect(
      runExperimentSql.execute({
        sql: 'SELECT 1',
        parameters: [],
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
    'prepare → run SELECT → structured results',
    async () => {
      await prepareDataset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });

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
          labSlug: 'index-playground',
        },
      });

      expect(result.rowCount).toBe(1);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.statementKind).toBe(SqlStatementKind.SELECT);
      expect(result.dataset).toEqual({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });
      expect(typeof (result.rows[0] as { cnt: number }).cnt).toBe('number');
    },
    60_000,
  );

  it('blocks sandbox violations before execution', async () => {
    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    await expect(
      runExperimentSql.execute({
        sql: 'DROP DATABASE playground_db',
        parameters: [],
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

  it('returns execution error for invalid SQL syntax', async () => {
    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    try {
      await runExperimentSql.execute({
        sql: 'SELEC 1',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });
      fail('expected syntax error');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      const domainError = error as DomainError;
      expect([
        ErrorCode.EXECUTION_ERROR,
        ErrorCode.SANDBOX_ERROR,
      ]).toContain(domainError.code);
    }
  });

  it('blocks execution while dataset is resetting', async () => {
    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    await resetDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    await expect(
      runExperimentSql.execute({
        sql: 'SELECT 1',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_1M,
          version: 'v1',
        },
      }),
    ).rejects.toMatchObject({
      details: {
        reason: 'DATASET_NOT_READY',
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

        await runExperimentSql.execute({
          sql: 'SELECT count(*)::int AS cnt FROM users',
          parameters: [],
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
