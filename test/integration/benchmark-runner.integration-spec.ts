import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { RedisModule } from '../../src/common/services/redis.module';
import { RedisService } from '../../src/common/services/redis.service';
import { RateLimitModule } from '../../src/modules/rate-limit/rate-limit.module';
import { ExperimentIsolationModule } from '../../src/modules/experiment-isolation/experiment-isolation.module';
import { SqlSandboxModule } from '../../src/modules/sql-sandbox/sql-sandbox.module';
import { BenchmarkRunnerModule } from '../../src/modules/benchmark-runner/benchmark-runner.module';
import { EnqueueBenchmarkUseCase } from '../../src/modules/benchmark-runner/application/enqueue-benchmark.usecase';
import { GetBenchmarkStatusUseCase } from '../../src/modules/benchmark-runner/application/get-benchmark-status.usecase';
import { ProvisionExperimentSessionUseCase } from '../../src/modules/experiment-isolation/application/provision-experiment-session.usecase';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { TracksModule } from '../../src/modules/tracks/tracks.module';
import { WorkerQueueModule } from '../../src/modules/worker-queue/worker-queue.module';
import { JobQueueProducer } from '../../src/modules/worker-queue/infrastructure/job-queue.producer';
import {
  BenchmarkJobStatus,
  DatasetTier,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../src/common/errors/domain.error';

const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;
const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;

const describeIfInfra =
  redisConfigured && platformConfigured && playgroundConfigured
    ? describe
    : describe.skip;

describeIfInfra('Benchmark Runner (integration)', () => {
  let moduleRef: TestingModule;
  let enqueueBenchmark: EnqueueBenchmarkUseCase;
  let getBenchmarkStatus: GetBenchmarkStatusUseCase;
  let provisionSession: ProvisionExperimentSessionUseCase;
  let redisService: RedisService;

  let sessionId: string;
  const clientToken = `bench-${Date.now()}`;

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
        TracksModule,
        RedisModule,
        RateLimitModule,
        ExperimentIsolationModule,
        SqlSandboxModule,
        WorkerQueueModule,
        BenchmarkRunnerModule,
      ],
    })
      .overrideProvider(JobQueueProducer)
      .useValue({
        enqueue: jest.fn().mockResolvedValue(undefined),
        getMaxAttempts: jest.fn().mockReturnValue(2),
        getQueueName: jest.fn().mockReturnValue('benchmark-jobs'),
      })
      .compile();

    enqueueBenchmark = moduleRef.get(EnqueueBenchmarkUseCase);
    getBenchmarkStatus = moduleRef.get(GetBenchmarkStatusUseCase);
    provisionSession = moduleRef.get(ProvisionExperimentSessionUseCase);
    redisService = moduleRef.get(RedisService);

    const session = await provisionSession.execute({
      clientSessionToken: clientToken,
      trackSlug: 'database-sql',
      labSlug: 'benchmark-lab',
      dataset: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      },
    });

    sessionId = session.sessionId;
  }, 120_000);

  afterAll(async () => {
    const client = redisService.getClient();
    const keys = await client.keys('jobs:*');
    if (keys.length > 0) {
      await client.del(...keys);
    }
    await moduleRef.close();
  });

  it('enqueues benchmark jobs without blocking on execution', async () => {
    const started = Date.now();

    const result = await enqueueBenchmark.execute({
      sessionId,
      profile: { rps: 100, durationSeconds: 10 },
      target: {
        sql: 'SELECT 1 AS ok',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      },
      context: { userId: 'bench-user-1', labSlug: 'benchmark-lab' },
    });

    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.status).toBe(BenchmarkJobStatus.QUEUED);
    expect(result.jobId).toBeDefined();
  });

  it('rejects unsupported benchmark profiles', async () => {
    await expect(
      enqueueBenchmark.execute({
        sessionId,
        profile: { rps: 300, durationSeconds: 10 },
        target: {
          sql: 'SELECT 1',
          parameters: [],
          dataset: {
            family: 'commerce',
            tier: DatasetTier.TIER_100K,
            version: 'v1',
          },
        },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('returns lifecycle status for the owning user', async () => {
    const enqueued = await enqueueBenchmark.execute({
      sessionId,
      profile: { rps: 500, durationSeconds: 10 },
      target: {
        sql: 'SELECT 1',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      },
      context: { userId: 'bench-user-2' },
    });

    const status = await getBenchmarkStatus.execute({
      jobId: enqueued.jobId,
      userId: 'bench-user-2',
    });

    expect(status.jobId).toBe(enqueued.jobId);
    expect(status.status).toBe(BenchmarkJobStatus.QUEUED);
  });

  it('forbids status access for another user', async () => {
    const enqueued = await enqueueBenchmark.execute({
      sessionId,
      profile: { rps: 100, durationSeconds: 10 },
      target: {
        sql: 'SELECT 1',
        parameters: [],
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
      },
      context: { userId: 'owner-user' },
    });

    await expect(
      getBenchmarkStatus.execute({
        jobId: enqueued.jobId,
        userId: 'other-user',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
