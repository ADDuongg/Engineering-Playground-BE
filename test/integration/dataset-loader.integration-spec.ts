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
import { GetDatasetMetadataUseCase } from '../../src/modules/dataset-loader/application/get-dataset-metadata.usecase';
import { RedisModule } from '../../src/common/services/redis.module';
import {
  DatasetReadinessStatus,
  DatasetTier,
} from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra = playgroundConfigured && redisConfigured && platformConfigured
  ? describe
  : describe.skip;

describeIfInfra('Dataset Loader (integration)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let getMetadata: GetDatasetMetadataUseCase;

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
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    getMetadata = moduleRef.get(GetDatasetMetadataUseCase);
  }, 60_000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await moduleRef.close();
  });

  it(
    'loads commerce 100k dataset with expected tables',
    async () => {
      const result = await prepareDataset.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      });

      expect(result.status).toBe(DatasetReadinessStatus.READY);
      expect(result.durationMs).toBeLessThan(30_000);

      const metadata = await getMetadata.execute(
        'commerce',
        DatasetTier.TIER_100K,
        'v1',
      );

      expect(metadata.status).toBe(DatasetReadinessStatus.READY);
      expect(metadata.tables).toHaveLength(5);

      for (const table of metadata.tables) {
        expect(table.actualRowCount).not.toBeNull();
        const tolerance = table.targetRowCount * 0.01;
        expect(table.actualRowCount).toBeGreaterThanOrEqual(
          table.targetRowCount - tolerance,
        );
        expect(table.actualRowCount).toBeLessThanOrEqual(
          table.targetRowCount + tolerance,
        );
      }
    },
    60_000,
  );

  it('returns preparing for 1m async tier', async () => {
    const result = await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    expect(result.status).toBe(DatasetReadinessStatus.PREPARING);
  });
});
