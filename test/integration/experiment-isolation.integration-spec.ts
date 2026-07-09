import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { RedisModule } from '../../src/common/services/redis.module';
import { ExperimentIsolationModule } from '../../src/modules/experiment-isolation/experiment-isolation.module';
import { DatasetLoaderModule } from '../../src/modules/dataset-loader/dataset-loader.module';
import { ExperimentRunnerModule } from '../../src/modules/experiment-runner/experiment-runner.module';
import { ProvisionExperimentSessionUseCase } from '../../src/modules/experiment-isolation/application/provision-experiment-session.usecase';
import { TeardownExperimentSessionUseCase } from '../../src/modules/experiment-isolation/application/teardown-experiment-session.usecase';
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { RunExperimentSqlUseCase } from '../../src/modules/experiment-runner/application/run-experiment-sql.usecase';
import {
  DatasetReadinessStatus,
  DatasetTier,
  ExperimentSessionStatus,
} from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra =
  playgroundConfigured && redisConfigured && platformConfigured
    ? describe
    : describe.skip;

describeIfInfra('Experiment Isolation (integration)', () => {
  let moduleRef: TestingModule;
  let provisionSession: ProvisionExperimentSessionUseCase;
  let teardownSession: TeardownExperimentSessionUseCase;
  let prepareDataset: PrepareDatasetUseCase;
  let runExperimentSql: RunExperimentSqlUseCase;
  let platformDataSource: DataSource;

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
        ExperimentRunnerModule,
      ],
    }).compile();

    provisionSession = moduleRef.get(ProvisionExperimentSessionUseCase);
    teardownSession = moduleRef.get(TeardownExperimentSessionUseCase);
    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    runExperimentSql = moduleRef.get(RunExperimentSqlUseCase);
    platformDataSource = moduleRef.get(getDataSourceToken('platform'));
  }, 120_000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await moduleRef.close();
  });

  async function provisionAndPrepare(token: string) {
    const session = await provisionSession.execute({
      clientSessionToken: token,
      trackSlug: 'database-sql',
      labSlug: 'index-playground',
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      },
    });

    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
      sessionId: session.sessionId,
    });

    return session;
  }

  it('provisions distinct schemas for concurrent sessions', async () => {
    const sessionA = await provisionSession.execute({
      clientSessionToken: 'iso-client-a',
      trackSlug: 'database-sql',
      labSlug: 'index-playground',
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
      },
    });
    const sessionB = await provisionSession.execute({
      clientSessionToken: 'iso-client-b',
      trackSlug: 'database-sql',
      labSlug: 'index-playground',
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
      },
    });

    expect(sessionA.schemaName).toBeDefined();
    expect(sessionB.schemaName).toBeDefined();
    expect(sessionA.schemaName).not.toBe(sessionB.schemaName);
    expect(sessionA.status).toBe(ExperimentSessionStatus.READY);

    await teardownSession.execute({ sessionId: sessionA.sessionId });
    await teardownSession.execute({ sessionId: sessionB.sessionId });
  });

  it(
    'isolates mutations between sessions',
    async () => {
      const sessionA = await provisionAndPrepare('iso-mut-a');
      const sessionB = await provisionAndPrepare('iso-mut-b');

      await runExperimentSql.execute({
        sql: 'CREATE INDEX IF NOT EXISTS idx_isolation_a ON users (email)',
        parameters: [],
        sessionId: sessionA.sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      const indexCountB = await runExperimentSql.execute({
        sql: `SELECT count(*)::int AS cnt FROM pg_indexes
              WHERE schemaname = current_schema() AND indexname = 'idx_isolation_a'`,
        parameters: [],
        sessionId: sessionB.sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      const indexCountA = await runExperimentSql.execute({
        sql: `SELECT count(*)::int AS cnt FROM pg_indexes
              WHERE schemaname = current_schema() AND indexname = 'idx_isolation_a'`,
        parameters: [],
        sessionId: sessionA.sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      expect(indexCountB.rows[0]?.cnt).toBe(0);
      expect(indexCountA.rows[0]?.cnt).toBe(1);

      const resultB = await runExperimentSql.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        sessionId: sessionB.sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      const baselineB = await runExperimentSql.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        sessionId: sessionB.sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      expect(resultB.rows[0]?.cnt).toBe(baselineB.rows[0]?.cnt);

      await teardownSession.execute({ sessionId: sessionA.sessionId });
      await teardownSession.execute({ sessionId: sessionB.sessionId });
    },
    120_000,
  );

  it(
    'full flow: provision → prepare → run → teardown',
    async () => {
      const session = await provisionAndPrepare('iso-flow-client');

      const prepareStatus = await prepareDataset.getStatus(
        'commerce',
        DatasetTier.TIER_100K,
        'v1',
        session.sessionId,
      );
      expect(prepareStatus.status).toBe(DatasetReadinessStatus.READY);

      const result = await runExperimentSql.execute({
        sql: 'SELECT count(*)::int AS cnt FROM users',
        parameters: [],
        sessionId: session.sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      });

      expect(result.rowCount).toBe(1);
      expect(typeof result.rows[0]?.cnt).toBe('number');

      await teardownSession.execute({ sessionId: session.sessionId });
    },
    120_000,
  );

  it('leaves platform database unchanged after session workload', async () => {
    const tracksBefore = await platformDataSource.query(
      'SELECT count(*)::int AS cnt FROM tracks',
    );

    const session = await provisionAndPrepare('iso-platform-client');

    await runExperimentSql.execute({
      sql: 'SELECT 1 AS n',
      parameters: [],
      sessionId: session.sessionId,
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      },
    });

    await teardownSession.execute({ sessionId: session.sessionId });

    const tracksAfter = await platformDataSource.query(
      'SELECT count(*)::int AS cnt FROM tracks',
    );

    expect(tracksAfter[0]?.cnt).toBe(tracksBefore[0]?.cnt);
  });
});
