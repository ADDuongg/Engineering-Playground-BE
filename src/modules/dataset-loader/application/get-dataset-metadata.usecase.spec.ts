import {
  DatasetReadinessStatus,
  DatasetTier,
} from '@db-play/types';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { GetDatasetMetadataUseCase } from './get-dataset-metadata.usecase';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetSeedRunner } from '../infrastructure/dataset-seed.runner';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';

describe('GetDatasetMetadataUseCase', () => {
  const identity = {
    family: {
      id: 'commerce',
      label: 'Commerce Baseline',
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
        {
          name: 'users',
          label: 'Users',
          description: 'Registered customers',
          targetRowCount: 10000,
        },
      ],
    },
  };

  let manifestRepository: jest.Mocked<DatasetManifestRepository>;
  let seedRunner: jest.Mocked<DatasetSeedRunner>;
  let statusStore: jest.Mocked<DatasetPreparationStatusStore>;
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let useCase: GetDatasetMetadataUseCase;

  beforeEach(() => {
    manifestRepository = {
      resolveIdentity: jest.fn().mockReturnValue(identity),
      getDefaultVersion: jest.fn().mockReturnValue('v1'),
    } as unknown as jest.Mocked<DatasetManifestRepository>;

    seedRunner = {
      countTableRows: jest.fn().mockResolvedValue(10000),
    } as unknown as jest.Mocked<DatasetSeedRunner>;

    statusStore = {
      getOrDefault: jest.fn().mockResolvedValue({
        family: 'commerce',
        version: 'v1',
        tier: DatasetTier.TIER_100K,
        status: DatasetReadinessStatus.READY,
      }),
    } as unknown as jest.Mocked<DatasetPreparationStatusStore>;

    getExperimentSession = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    useCase = new GetDatasetMetadataUseCase(
      manifestRepository,
      seedRunner,
      statusStore,
      getExperimentSession,
    );
  });

  it('returns metadata with live counts when ready', async () => {
    const metadata = await useCase.execute('commerce', DatasetTier.TIER_100K, 'v1');

    expect(metadata.family).toBe('commerce');
    expect(metadata.status).toBe(DatasetReadinessStatus.READY);
    expect(metadata.tables[0].actualRowCount).toBe(10000);
  });

  it('returns null actual counts when not ready', async () => {
    statusStore.getOrDefault.mockResolvedValue({
      family: 'commerce',
      version: 'v1',
      tier: DatasetTier.TIER_100K,
      status: DatasetReadinessStatus.PREPARING,
      startedAt: new Date().toISOString(),
    });

    const metadata = await useCase.execute('commerce', DatasetTier.TIER_100K, 'v1');
    expect(metadata.tables[0].actualRowCount).toBeNull();
    expect(seedRunner.countTableRows).not.toHaveBeenCalled();
  });
});
