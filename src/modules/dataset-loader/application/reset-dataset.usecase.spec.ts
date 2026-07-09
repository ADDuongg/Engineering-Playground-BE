import { ConfigService } from '@nestjs/config';
import {
  DatasetReadinessStatus,
  DatasetTier,
  ErrorCode,
  ExperimentSessionStatus,
  JobStatus,
  JobType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { EnqueueJobService } from '../../worker-queue/application/enqueue-job.service';
import { ResetDatasetUseCase } from './reset-dataset.usecase';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';

describe('ResetDatasetUseCase', () => {
  const identity = {
    family: {
      id: 'commerce',
      label: 'Commerce',
      description: 'desc',
      versions: [],
    },
    version: {
      id: 'v1',
      schemaPath: 'commerce/v1/schema.sql',
      tiers: [],
    },
    tier: {
      id: DatasetTier.TIER_100K,
      seedPath: 'commerce/v1/seed-100k.sql',
      tables: [
        { name: 'users', label: 'Users', description: 'd', targetRowCount: 1000 },
        { name: 'orders', label: 'Orders', description: 'd', targetRowCount: 1000 },
      ],
    },
  };

  let manifestRepository: jest.Mocked<DatasetManifestRepository>;
  let statusStore: jest.Mocked<DatasetPreparationStatusStore>;
  let configService: jest.Mocked<ConfigService>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let rateLimitService: jest.Mocked<RateLimitService>;
  let enqueueJobService: jest.Mocked<EnqueueJobService>;
  let useCase: ResetDatasetUseCase;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    manifestRepository = {
      resolveIdentity: jest.fn().mockReturnValue(identity),
      getDefaultVersion: jest.fn().mockReturnValue('v1'),
    } as unknown as jest.Mocked<DatasetManifestRepository>;

    statusStore = {
      get: jest.fn().mockResolvedValue(null),
      getOrDefault: jest.fn(),
      buildKey: jest.fn().mockReturnValue('dataset:prep:commerce:v1:100k'),
    } as unknown as jest.Mocked<DatasetPreparationStatusStore>;

    configService = {
      get: jest.fn((_key: string, defaultValue?: string | number) => defaultValue),
    } as unknown as jest.Mocked<ConfigService>;

    getExperimentSession = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    rateLimitService = {
      consumeQuota: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RateLimitService>;

    enqueueJobService = {
      enqueue: jest.fn().mockResolvedValue({
        job: {
          id: 'job-1',
          jobType: JobType.DATASET_RESET,
          status: JobStatus.QUEUED,
          createdAt: '2026-07-09T00:00:00.000Z',
          attemptCount: 0,
          maxAttempts: 3,
          userId: null,
          sessionId: null,
        },
      }),
    } as unknown as jest.Mocked<EnqueueJobService>;

    useCase = new ResetDatasetUseCase(
      manifestRepository,
      statusStore,
      configService,
      getExperimentSession,
      rateLimitService,
      enqueueJobService,
    );

    logSpy = jest.spyOn(
      (useCase as unknown as { logger: { log: (payload: unknown) => void } })
        .logger,
      'log',
    );
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('enqueues reset for any tier and returns queued job', async () => {
    const result = await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    expect(result).toEqual({
      jobId: 'job-1',
      jobType: 'dataset-reset',
      status: JobStatus.QUEUED,
      createdAt: '2026-07-09T00:00:00.000Z',
      family: 'commerce',
      version: 'v1',
      tier: DatasetTier.TIER_100K,
    });

    expect(rateLimitService.consumeQuota).toHaveBeenCalled();
    expect(enqueueJobService.enqueue).toHaveBeenCalledWith({
      jobType: JobType.DATASET_RESET,
      userId: null,
      sessionId: null,
      body: {
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
        sessionId: undefined,
        schemaName: undefined,
        context: undefined,
      },
      payloadSummary: {
        family: 'commerce',
        version: 'v1',
        tier: DatasetTier.TIER_100K,
      },
    });
  });

  it('enqueues 1m tier the same as small tiers', async () => {
    const result = await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    expect(result.status).toBe(JobStatus.QUEUED);
    expect(result.jobId).toBe('job-1');
    expect(enqueueJobService.enqueue).toHaveBeenCalled();
  });

  it('resolves schema from ready experiment session', async () => {
    getExperimentSession.execute.mockResolvedValue({
      id: 'sess-1',
      schemaName: 'exp_sess_1',
      status: ExperimentSessionStatus.READY,
    } as never);

    await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
      sessionId: 'sess-1',
      context: { userId: 'user-1', requestId: 'req-1' },
    });

    expect(enqueueJobService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'sess-1',
        body: expect.objectContaining({
          sessionId: 'sess-1',
          schemaName: 'exp_sess_1',
        }),
      }),
    );
  });

  it('propagates NOT_FOUND for unknown version', async () => {
    manifestRepository.resolveIdentity.mockImplementation(() => {
      throw new DomainError(ErrorCode.NOT_FOUND, 'missing version', 404, {
        code: 'UNKNOWN_VERSION',
      });
    });

    await expect(
      useCase.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v99',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });

    expect(enqueueJobService.enqueue).not.toHaveBeenCalled();
  });

  it('emits structured dataset_reset_enqueued audit log', async () => {
    await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
      context: { requestId: 'req-1', labSlug: 'index-lab' },
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'dataset_reset_enqueued',
        jobId: 'job-1',
        family: 'commerce',
        version: 'v1',
        tier: DatasetTier.TIER_100K,
        requestId: 'req-1',
        labSlug: 'index-lab',
      }),
    );
  });

  it('reports stale resetting jobs as failed via getStatus', async () => {
    statusStore.getOrDefault.mockResolvedValue({
      family: 'commerce',
      version: 'v1',
      tier: DatasetTier.TIER_100K,
      status: DatasetReadinessStatus.RESETTING,
      startedAt: '2020-01-01T00:00:00.000Z',
      completedAt: null,
      durationMs: null,
      error: null,
    });

    const status = await useCase.getStatus(
      'commerce',
      DatasetTier.TIER_100K,
      'v1',
    );

    expect(status.status).toBe(DatasetReadinessStatus.FAILED);
    expect(status.error?.code).toBe('RESET_STALE');
  });
});
