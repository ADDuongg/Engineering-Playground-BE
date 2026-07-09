import {
  DatasetTier,
  ErrorCode,
  ExperimentSessionStatus,
  RuntimeAdapterType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetTrackBySlugUseCase } from '../../tracks/application/get-track-by-slug.usecase';
import { ExperimentSessionStore } from '../infrastructure/experiment-session.store';
import { PlaygroundSchemaProvisioner } from '../infrastructure/playground-schema.provisioner';
import { ProvisionExperimentSessionUseCase } from './provision-experiment-session.usecase';

describe('ProvisionExperimentSessionUseCase', () => {
  let sessionStore: jest.Mocked<ExperimentSessionStore>;
  let schemaProvisioner: jest.Mocked<PlaygroundSchemaProvisioner>;
  let getTrackBySlug: jest.Mocked<GetTrackBySlugUseCase>;
  let configService: { get: jest.Mock };
  let useCase: ProvisionExperimentSessionUseCase;

  const baseInput = {
    clientSessionToken: 'client-a',
    trackSlug: 'database-sql',
    labSlug: 'index-playground',
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
  };

  beforeEach(() => {
    sessionStore = {
      findByLookup: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      touchActivity: jest.fn(),
    } as unknown as jest.Mocked<ExperimentSessionStore>;

    schemaProvisioner = {
      createSchemaName: jest.fn().mockReturnValue('exp_abc123def456'),
      createSchema: jest.fn().mockResolvedValue(undefined),
      dropSchema: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PlaygroundSchemaProvisioner>;

    getTrackBySlug = {
      execute: jest.fn().mockResolvedValue({
        slug: 'database-sql',
        runtimeAdapterType: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
      }),
    } as unknown as jest.Mocked<GetTrackBySlugUseCase>;

    configService = {
      get: jest.fn().mockReturnValue(3600),
    };

    useCase = new ProvisionExperimentSessionUseCase(
      sessionStore,
      schemaProvisioner,
      getTrackBySlug,
      configService as never,
    );
  });

  it('provisions a new session with schema', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.status).toBe(ExperimentSessionStatus.READY);
    expect(result.schemaName).toBe('exp_abc123def456');
    expect(result.reused).toBe(false);
    expect(schemaProvisioner.createSchema).toHaveBeenCalledWith(
      'exp_abc123def456',
    );
    expect(sessionStore.save).toHaveBeenCalled();
  });

  it('reuses an active ready session', async () => {
    const existing = {
      sessionId: 'session-1',
      clientSessionToken: 'client-a',
      status: ExperimentSessionStatus.READY,
      trackSlug: 'database-sql',
      labSlug: 'index-playground',
      runtimeAdapter: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
      schemaName: 'exp_existing123',
      dataset: baseInput.dataset,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    sessionStore.findByLookup.mockResolvedValue(existing);
    sessionStore.touchActivity.mockResolvedValue(existing);

    const result = await useCase.execute(baseInput);

    expect(result.reused).toBe(true);
    expect(result.sessionId).toBe('session-1');
    expect(schemaProvisioner.createSchema).not.toHaveBeenCalled();
  });

  it('rejects unsupported track runtime adapters', async () => {
    getTrackBySlug.execute.mockResolvedValue({
      slug: 'react-rendering',
      runtimeAdapterType: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
    } as never);

    await expect(useCase.execute({
      ...baseInput,
      trackSlug: 'react-rendering',
    })).rejects.toMatchObject({
      code: ErrorCode.EXECUTION_ERROR,
      details: {
        reason: 'ISOLATION_UNSUPPORTED_TRACK',
        trackSlug: 'react-rendering',
      },
    });
  });

  it('cleans up schema and marks failed when provisioning fails', async () => {
    schemaProvisioner.createSchema.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.EXECUTION_ERROR,
      details: {
        reason: 'ISOLATION_PROVISION_FAILED',
      },
    });

    expect(schemaProvisioner.dropSchema).toHaveBeenCalledWith(
      'exp_abc123def456',
    );
    expect(sessionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ExperimentSessionStatus.FAILED,
      }),
    );
  });

  it('allows retry after failed provisioning', async () => {
    schemaProvisioner.createSchema
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(undefined);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(DomainError);

    sessionStore.findByLookup.mockResolvedValue(null);

    const result = await useCase.execute(baseInput);

    expect(result.status).toBe(ExperimentSessionStatus.READY);
    expect(schemaProvisioner.createSchema).toHaveBeenCalledTimes(2);
  });
});
