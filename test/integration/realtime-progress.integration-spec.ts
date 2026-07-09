import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { firstValueFrom, take, toArray } from 'rxjs';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { RedisModule } from '../../src/common/services/redis.module';
import { RedisService } from '../../src/common/services/redis.service';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { ExperimentIsolationModule } from '../../src/modules/experiment-isolation/experiment-isolation.module';
import { WorkerQueueModule } from '../../src/modules/worker-queue/worker-queue.module';
import { ProvisionExperimentSessionUseCase } from '../../src/modules/experiment-isolation/application/provision-experiment-session.usecase';
import { ObserveBenchmarkProgressUseCase } from '../../src/modules/benchmark-runner/application/observe-benchmark-progress.usecase';
import { BenchmarkProgressStore } from '../../src/modules/benchmark-runner/infrastructure/benchmark-progress.store';
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

describeIfInfra('Realtime Progress (integration)', () => {
  let moduleRef: TestingModule;
  let observe: ObserveBenchmarkProgressUseCase;
  let progressStore: BenchmarkProgressStore;
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
      ],
      providers: [BenchmarkProgressStore, ObserveBenchmarkProgressUseCase],
    }).compile();

    observe = moduleRef.get(ObserveBenchmarkProgressUseCase);
    progressStore = moduleRef.get(BenchmarkProgressStore);
    jobStore = moduleRef.get(JobStore);
    redisService = moduleRef.get(RedisService);

    const provision = moduleRef.get(ProvisionExperimentSessionUseCase);
    const session = await provision.execute({
      clientSessionToken: `realtime-progress-${Date.now()}`,
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
    await moduleRef?.close();
  });

  async function seedJob(overrides: {
    jobId: string;
    status?: JobStatus;
    userId?: string | null;
  }) {
    const status = overrides.status ?? JobStatus.QUEUED;
    const now = new Date().toISOString();
    await jobStore.save({
      id: overrides.jobId,
      jobType: JobType.BENCHMARK,
      userId: overrides.userId === undefined ? 'user-rt' : overrides.userId,
      sessionId,
      status,
      payloadSummary: {
        profile: { rps: 100, durationSeconds: 10 },
        metricsStatus: 'pending',
      },
      createdAt: now,
      startedAt:
        status === JobStatus.QUEUED ? undefined : now,
      completedAt:
        status === JobStatus.COMPLETED || status === JobStatus.FAILED
          ? now
          : undefined,
      attemptCount: status === JobStatus.QUEUED ? 0 : 1,
      maxAttempts: 2,
    });
    return overrides.jobId;
  }

  it('streams queued progress then running updates via Redis pub/sub', async () => {
    const jobId = `rt-int-${Date.now()}-a`;
    await seedJob({ jobId });
    await progressStore.saveAndPublish({
      jobId,
      phase: BenchmarkJobStatus.QUEUED,
      elapsedMs: 0,
      elapsedBasis: 'queue',
      currentRps: null,
      provisional: true,
      terminal: false,
      updatedAt: new Date().toISOString(),
    });

    const eventsPromise = firstValueFrom(
      observe
        .execute({ jobId, sessionId })
        .pipe(take(2), toArray()),
    );

    await new Promise((r) => setTimeout(r, 100));

    await progressStore.saveAndPublish({
      jobId,
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: 1500,
      elapsedBasis: 'execution',
      currentRps: 92,
      partialMetrics: [
        {
          key: 'achieved_rps',
          label: 'Achieved RPS',
          unit: 'rps',
          value: 92,
          group: 'throughput',
          provisional: true,
        },
        {
          key: 'latency_avg_ms',
          label: 'Average Latency',
          unit: 'ms',
          value: 14,
          group: 'latency',
          provisional: true,
        },
      ],
      provisional: true,
      terminal: false,
      updatedAt: new Date().toISOString(),
    });

    const events = await eventsPromise;
    expect(events[0].type).toBe('progress');
    expect(events[1].type).toBe('progress');
    if (events[1].type === 'progress') {
      expect(events[1].data.currentRps).toBe(92);
      expect(events[1].data.partialMetrics?.every((m) => m.provisional)).toBe(
        true,
      );
    }
  }, 30_000);

  it('reconnects with latest snapshot', async () => {
    const jobId = `rt-int-${Date.now()}-b`;
    await seedJob({ jobId, status: JobStatus.RUNNING });
    await progressStore.saveAndPublish({
      jobId,
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: 3000,
      elapsedBasis: 'execution',
      currentRps: 80,
      provisional: true,
      terminal: false,
      updatedAt: new Date().toISOString(),
    });

    const first = await firstValueFrom(
      observe.execute({ jobId, sessionId }).pipe(take(1)),
    );
    expect(first.type).toBe('progress');

    const second = await firstValueFrom(
      observe.execute({ jobId, sessionId }).pipe(take(1)),
    );
    expect(second.type).toBe('progress');
    if (second.type === 'progress') {
      expect(second.data.currentRps).toBe(80);
    }
  }, 30_000);

  it('emits terminal without final metrics and closes', async () => {
    const jobId = `rt-int-${Date.now()}-c`;
    await seedJob({ jobId, status: JobStatus.COMPLETED });
    const events = await firstValueFrom(
      observe.execute({ jobId, sessionId }).pipe(toArray()),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('terminal');
    if (events[0].type === 'terminal') {
      expect(events[0].data.terminal).toBe(true);
      expect((events[0].data as { metrics?: unknown }).metrics).toBeUndefined();
    }
  }, 30_000);

  it('denies cross-user observe', async () => {
    const jobId = `rt-int-${Date.now()}-d`;
    await seedJob({ jobId, userId: 'owner-a' });
    await expect(
      firstValueFrom(
        observe.execute({
          jobId,
          userId: 'owner-b',
          sessionId: 'wrong-session',
        }),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  }, 30_000);

  it('seeds from job status when redis snapshot missing', async () => {
    const jobId = `rt-int-${Date.now()}-e`;
    await seedJob({ jobId, status: JobStatus.RUNNING });
    await redisService.getClient().del(`benchmark:progress:${jobId}`);

    const event = await firstValueFrom(
      observe.execute({ jobId, sessionId }).pipe(take(1)),
    );
    expect(event.type).toBe('progress');
    if (event.type === 'progress') {
      expect(event.data.phase).toBe(BenchmarkJobStatus.RUNNING);
      expect(event.data.elapsedBasis).toBe('execution');
      expect(event.data.currentRps).toBeNull();
    }
  }, 30_000);
});
