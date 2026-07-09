import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { DatasetLoaderModule } from '../../src/modules/dataset-loader/dataset-loader.module';
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { ResetDatasetUseCase } from '../../src/modules/dataset-loader/application/reset-dataset.usecase';
import { GetDatasetMetadataUseCase } from '../../src/modules/dataset-loader/application/get-dataset-metadata.usecase';
import { PlaygroundDatabaseService } from '../../src/database/playground/playground-database.service';
import { RedisModule } from '../../src/common/services/redis.module';
import {
  DatasetTier,
  JobStatus,
} from '@db-play/types';
import { ExecuteDatasetResetService } from '../../src/modules/dataset-loader/application/execute-dataset-reset.service';
import { RateLimitModule } from '../../src/modules/rate-limit/rate-limit.module';
import { WorkerQueueModule } from '../../src/modules/worker-queue/worker-queue.module';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra = playgroundConfigured && redisConfigured && platformConfigured
  ? describe
  : describe.skip;

describeIfInfra('Dataset Reset (integration)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let resetDataset: ResetDatasetUseCase;
  let executeDatasetReset: ExecuteDatasetResetService;
  let getMetadata: GetDatasetMetadataUseCase;
  let playgroundDb: PlaygroundDatabaseService;

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
        RateLimitModule,
        WorkerQueueModule,
        DatasetLoaderModule,
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    resetDataset = moduleRef.get(ResetDatasetUseCase);
    executeDatasetReset = moduleRef.get(ExecuteDatasetResetService);
    getMetadata = moduleRef.get(GetDatasetMetadataUseCase);
    playgroundDb = moduleRef.get(PlaygroundDatabaseService);
  }, 60_000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await moduleRef.close();
  });

  it(
    'restores baseline after experiment mutations',
    async () => {
      await prepareDataset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });

      const metadataBefore = await getMetadata.execute(
        'commerce',
        DatasetTier.TIER_100K,
        'v1',
      );
      const usersBefore = metadataBefore.tables.find((t) => t.name === 'users');

      await playgroundDb.query(
        'CREATE TABLE learner_scratch (id int PRIMARY KEY)',
      );
      await playgroundDb.query(
        'CREATE INDEX IF NOT EXISTS idx_users_email_reset_test ON users(email)',
      );
      await playgroundDb.query(
        "INSERT INTO users (email, name) VALUES ('reset-test@example.com', 'Reset Test')",
      );

      const enqueueResult = await resetDataset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });

      expect(enqueueResult.status).toBe(JobStatus.QUEUED);
      expect(enqueueResult.jobType).toBe('dataset-reset');
      expect(enqueueResult.jobId).toBeDefined();

      const durationMs = await executeDatasetReset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });
      expect(durationMs).toBeLessThan(30_000);

      const metadataAfter = await getMetadata.execute(
        'commerce',
        DatasetTier.TIER_100K,
        'v1',
      );

      const usersAfter = metadataAfter.tables.find((t) => t.name === 'users');
      expect(usersAfter?.actualRowCount).toBe(usersBefore?.actualRowCount);

      const extraTables = await playgroundDb.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'learner_scratch'`,
      );
      expect(extraTables).toHaveLength(0);

      const extraIndexes = await playgroundDb.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = 'idx_users_email_reset_test'`,
      );
      expect(extraIndexes).toHaveLength(0);
    },
    60_000,
  );

  it('returns queued job for any tier including 1m', async () => {
    const result = await resetDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    expect(result.status).toBe(JobStatus.QUEUED);
    expect(result.jobType).toBe('dataset-reset');
    expect(result.jobId).toBeDefined();
    expect(result.tier).toBe(DatasetTier.TIER_1M);
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
        const beforeRows = await platformDs.query(
          'SELECT COUNT(*)::text AS count FROM tracks',
        );
        const beforeCount = parseInt(
          (beforeRows as { count: string }[])[0]?.count ?? '0',
          10,
        );

        await resetDataset.execute({
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
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
