import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { RedisModule } from '../../src/common/services/redis.module';
import { RedisService } from '../../src/common/services/redis.service';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { ExperimentIsolationModule } from '../../src/modules/experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../../src/modules/metrics-pipeline/metrics-pipeline.module';
import { WorkerQueueModule } from '../../src/modules/worker-queue/worker-queue.module';
import { ProvisionExperimentSessionUseCase } from '../../src/modules/experiment-isolation/application/provision-experiment-session.usecase';
import { CollectBenchmarkMetricsUseCase } from '../../src/modules/metrics-pipeline/application/collect-benchmark-metrics.usecase';
import { GetBenchmarkMetricHistoryUseCase } from '../../src/modules/metrics-pipeline/application/get-benchmark-metric-history.usecase';
import { GetBenchmarkMetricsUseCase } from '../../src/modules/metrics-pipeline/application/get-benchmark-metrics.usecase';
import { GetBenchmarkStatusUseCase } from '../../src/modules/benchmark-runner/application/get-benchmark-status.usecase';
import { JobStore } from '../../src/modules/worker-queue/infrastructure/job.store';
import {
  BenchmarkJobStatus,
  DatasetTier,
  ErrorCode,
  JobStatus,
  JobType,
} from '@db-play/types';

const redisConfigured = process.env.REDIS_HOST;
const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;
const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;

const describeIfInfra =
  redisConfigured && platformConfigured && playgroundConfigured
    ? describe
    : describe.skip;

const k6Summary = {
  metrics: {
    http_req_duration: {
      values: { avg: 15, 'p(95)': 40, 'p(99)': 70 },
    },
    http_reqs: { values: { rate: 98 } },
    http_req_failed: { values: { rate: 0.02 } },
  },
};

describeIfInfra('Benchmark Metrics (integration)', () => {
  let moduleRef: TestingModule;
  let collect: CollectBenchmarkMetricsUseCase;
  let getStatus: GetBenchmarkStatusUseCase;
  let getMetrics: GetBenchmarkMetricsUseCase;
  let getHistory: GetBenchmarkMetricHistoryUseCase;
  let jobStore: JobStore;
  let redisService: RedisService;
  let sessionId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        EventEmitterModule.forRoot(),
        PlatformDatabaseModule,
        PlaygroundDatabaseModule,
        RedisModule,
        ExperimentIsolationModule,
        WorkerQueueModule,
        MetricsPipelineModule,
      ],
      providers: [GetBenchmarkStatusUseCase],
    }).compile();

    collect = moduleRef.get(CollectBenchmarkMetricsUseCase);
    getStatus = moduleRef.get(GetBenchmarkStatusUseCase);
    getMetrics = moduleRef.get(GetBenchmarkMetricsUseCase);
    getHistory = moduleRef.get(GetBenchmarkMetricHistoryUseCase);
    jobStore = moduleRef.get(JobStore);
    redisService = moduleRef.get(RedisService);

    const provision = moduleRef.get(ProvisionExperimentSessionUseCase);
    const session = await provision.execute({
      clientSessionToken: `bench-metrics-${Date.now()}`,
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

  async function seedCompletedJob(jobId: string) {
    await jobStore.save({
      id: jobId,
      jobType: JobType.BENCHMARK,
      userId: 'user-metrics',
      sessionId,
      status: JobStatus.COMPLETED,
      payloadSummary: {
        profile: { rps: 100, durationSeconds: 10 },
        dataset: {
          family: 'commerce',
          tier: DatasetTier.TIER_100K,
          version: 'v1',
        },
        context: {
          trackSlug: 'database-sql',
          labSlug: 'benchmark-lab',
        },
        metricsStatus: 'pending',
      },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      attemptCount: 1,
      maxAttempts: 2,
    });
  }

  it('auto-collects and embeds metrics on status + metrics-by-job', async () => {
    const jobId = `bm-int-${Date.now()}-a`;
    await seedCompletedJob(jobId);

    await collect.execute({
      jobId,
      sessionId,
      userId: 'user-metrics',
      status: BenchmarkJobStatus.COMPLETED,
      profile: { rps: 100, durationSeconds: 10 },
      k6Summary,
    });

    const status = await getStatus.execute({
      jobId,
      userId: 'user-metrics',
    });
    const byJob = await getMetrics.execute({
      jobId,
      userId: 'user-metrics',
    });

    expect(status.metricsStatus).toBe('ready');
    expect(status.metrics?.map((m) => m.key).sort()).toEqual(
      [
        'achieved_rps',
        'error_rate_pct',
        'latency_avg_ms',
        'latency_p95_ms',
        'latency_p99_ms',
        'throughput_rps',
      ].sort(),
    );
    expect(byJob.metrics).toEqual(status.metrics);
  });

  it('returns history with at least two snapshots', async () => {
    const jobId1 = `bm-int-${Date.now()}-h1`;
    const jobId2 = `bm-int-${Date.now()}-h2`;
    await seedCompletedJob(jobId1);
    await seedCompletedJob(jobId2);

    await collect.execute({
      jobId: jobId1,
      sessionId,
      userId: 'user-metrics',
      status: BenchmarkJobStatus.COMPLETED,
      profile: { rps: 100, durationSeconds: 10 },
      k6Summary,
    });
    await collect.execute({
      jobId: jobId2,
      sessionId,
      userId: 'user-metrics',
      status: BenchmarkJobStatus.COMPLETED,
      profile: { rps: 500, durationSeconds: 10 },
      k6Summary: {
        metrics: {
          http_req_duration: {
            values: { avg: 8, 'p(95)': 20, 'p(99)': 35 },
          },
          http_reqs: { values: { rate: 480 } },
          http_req_failed: { values: { rate: 0.01 } },
        },
      },
    });

    const history = await getHistory.execute({
      sessionId,
      labSlug: 'benchmark-lab',
    });

    expect(history.snapshots.length).toBeGreaterThanOrEqual(2);
    expect(history.snapshots.every((s) => s.runType === 'benchmark')).toBe(
      true,
    );
  });

  it('forbids cross-user metrics access', async () => {
    const jobId = `bm-int-${Date.now()}-f`;
    await seedCompletedJob(jobId);

    await expect(
      getMetrics.execute({ jobId, userId: 'other-user' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});
