import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { DatasetLoaderModule } from '../../src/modules/dataset-loader/dataset-loader.module';
import { SqlSandboxModule } from '../../src/modules/sql-sandbox/sql-sandbox.module';
import { ExperimentRunnerModule } from '../../src/modules/experiment-runner/experiment-runner.module';
import { ExperimentIsolationModule } from '../../src/modules/experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../../src/modules/metrics-pipeline/metrics-pipeline.module';
import { RateLimitModule } from '../../src/modules/rate-limit/rate-limit.module';
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { RunExperimentSqlUseCase } from '../../src/modules/experiment-runner/application/run-experiment-sql.usecase';
import { RateLimitService } from '../../src/modules/rate-limit/application/rate-limit.service';
import { RedisModule } from '../../src/common/services/redis.module';
import { RedisService } from '../../src/common/services/redis.service';
import { DomainError } from '../../src/common/errors/domain.error';
import { DatasetTier, ErrorCode, RateLimitOperation } from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfInfra = playgroundConfigured && redisConfigured && platformConfigured
  ? describe
  : describe.skip;

describeIfInfra('Per-User Rate Limit (integration)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let runExperimentSql: RunExperimentSqlUseCase;
  let rateLimitService: RateLimitService;
  let redisService: RedisService;
  let configService: ConfigService;

  const sessionId = `rate-limit-${Date.now()}`;

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
        ExperimentIsolationModule,
        MetricsPipelineModule,
        DatasetLoaderModule,
        SqlSandboxModule,
        ExperimentRunnerModule,
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    runExperimentSql = moduleRef.get(RunExperimentSqlUseCase);
    rateLimitService = moduleRef.get(RateLimitService);
    redisService = moduleRef.get(RedisService);
    configService = moduleRef.get(ConfigService);

    await prepareDataset.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
      sessionId,
    });
  }, 120_000);

  afterAll(async () => {
    const client = redisService.getClient();
    const keys = await client.keys('ratelimit:*');
    const testKeys = keys.filter((key) => key.includes(sessionId));
    if (testKeys.length > 0) {
      await client.del(...testKeys);
    }
    await moduleRef.close();
  });

  it('does not consume quota when sandbox validation fails', async () => {
    const consumeSpy = jest.spyOn(rateLimitService, 'consumeQuota');

    await expect(
      runExperimentSql.execute({
        sql: 'DROP DATABASE playground_db',
        parameters: [],
        sessionId,
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: { userId: `validation-user-${sessionId}` },
      }),
    ).rejects.toBeInstanceOf(DomainError);

    expect(consumeSpy).not.toHaveBeenCalled();
    consumeSpy.mockRestore();
  });

  it('isolates SQL run limits per user identity', async () => {
    const userA = `user-a-${sessionId}`;
    const userB = `user-b-${sessionId}`;

    const limitedConfig = {
      get: (key: string, defaultValue?: unknown) => {
        if (key === 'rateLimit.sqlRun') {
          return 2;
        }
        return configService.get(key, defaultValue);
      },
    } as ConfigService;

    const limitedService = new RateLimitService(redisService, limitedConfig);

    await limitedService.consumeQuota({
      operation: RateLimitOperation.SQL_RUN,
      userId: userA,
    });
    await limitedService.consumeQuota({
      operation: RateLimitOperation.SQL_RUN,
      userId: userA,
    });

    await expect(
      limitedService.consumeQuota({
        operation: RateLimitOperation.SQL_RUN,
        userId: userA,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMITED,
      statusCode: 429,
      details: expect.objectContaining({
        operation: RateLimitOperation.SQL_RUN,
        retryAfterSeconds: expect.any(Number),
      }),
    });

    await expect(
      limitedService.consumeQuota({
        operation: RateLimitOperation.SQL_RUN,
        userId: userB,
      }),
    ).resolves.toBeUndefined();
  });
});
