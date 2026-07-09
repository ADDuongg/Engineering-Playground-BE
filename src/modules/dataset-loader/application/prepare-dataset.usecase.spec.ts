import { ConfigService } from '@nestjs/config';
import {
  DatasetReadinessStatus,
  DatasetTier,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { PrepareDatasetUseCase } from './prepare-dataset.usecase';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetSeedRunner } from '../infrastructure/dataset-seed.runner';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';

describe('PrepareDatasetUseCase', () => {
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
      tables: [],
    },
  };

  let manifestRepository: jest.Mocked<DatasetManifestRepository>;
  let seedRunner: jest.Mocked<DatasetSeedRunner>;
  let statusStore: jest.Mocked<DatasetPreparationStatusStore>;
  let configService: jest.Mocked<ConfigService>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let useCase: PrepareDatasetUseCase;

  beforeEach(() => {
    manifestRepository = {
      resolveIdentity: jest.fn().mockReturnValue(identity),
      getDefaultVersion: jest.fn().mockReturnValue('v1'),
    } as unknown as jest.Mocked<DatasetManifestRepository>;

    seedRunner = {
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DatasetSeedRunner>;

    statusStore = {
      get: jest.fn().mockResolvedValue(null),
      markPreparing: jest.fn().mockImplementation(async (family, version, tier) => ({
        family,
        version,
        tier,
        status: DatasetReadinessStatus.PREPARING,
        startedAt: new Date().toISOString(),
      })),
      markReady: jest.fn().mockImplementation(async (family, version, tier, _startedAt, durationMs) => ({
        family,
        version,
        tier,
        status: DatasetReadinessStatus.READY,
        durationMs,
      })),
      markFailed: jest.fn(),
      getOrDefault: jest.fn(),
      buildKey: jest.fn().mockReturnValue('dataset:prep:commerce:v1:100k'),
    } as unknown as jest.Mocked<DatasetPreparationStatusStore>;

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'dataset.syncTierMax') {
          return '100k';
        }
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    getExperimentSession = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    useCase = new PrepareDatasetUseCase(
      manifestRepository,
      seedRunner,
      statusStore,
      configService,
      getExperimentSession,
    );
  });

  it('prepares 100k synchronously and returns ready', async () => {
    const result = await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    });

    expect(result.status).toBe(DatasetReadinessStatus.READY);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(seedRunner.run).toHaveBeenCalledWith(identity, undefined);
  });

  it('returns preparing for 1m async tier without throwing', async () => {
    const result = await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    expect(result.status).toBe(DatasetReadinessStatus.PREPARING);
    expect(result.startedAt).toBeDefined();
  });

  it('returns preparing for duplicate requests only while job is in flight', async () => {
    statusStore.get.mockResolvedValue({
      family: 'commerce',
      version: 'v1',
      tier: DatasetTier.TIER_1M,
      status: DatasetReadinessStatus.PREPARING,
      startedAt: '2026-07-08T00:00:00.000Z',
    });

    const inFlight = (useCase as unknown as { inFlight: Map<string, Promise<void>> })
      .inFlight;
    inFlight.set('dataset:prep:commerce:v1:100k', Promise.resolve());

    const result = await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    expect(result.status).toBe(DatasetReadinessStatus.PREPARING);
    expect(seedRunner.run).not.toHaveBeenCalled();
  });

  it('restarts orphaned preparing jobs when no in-flight worker exists', async () => {
    statusStore.get.mockResolvedValue({
      family: 'commerce',
      version: 'v1',
      tier: DatasetTier.TIER_1M,
      status: DatasetReadinessStatus.PREPARING,
      startedAt: '2026-07-08T00:00:00.000Z',
    });

    const result = await useCase.execute({
      family: 'commerce',
      tier: DatasetTier.TIER_1M,
      version: 'v1',
    });

    expect(result.status).toBe(DatasetReadinessStatus.PREPARING);
    expect(statusStore.markPreparing).toHaveBeenCalled();
  });

  it('throws EXECUTION_ERROR when sync preparation fails', async () => {
    seedRunner.run.mockRejectedValue(new Error('seed failed'));

    await expect(
      useCase.execute({
        family: 'commerce',
        tier: DatasetTier.TIER_100K,
        version: 'v1',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.EXECUTION_ERROR });
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
  });
});
