import {
  ErrorCode,
  ExperimentSessionStatus,
  RuntimeAdapterType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { CancelSessionJobsUseCase } from '../../worker-queue/application/cancel-session-jobs.usecase';
import { GetExperimentSessionUseCase } from './get-experiment-session.usecase';
import { ExperimentSessionStore } from '../infrastructure/experiment-session.store';
import { PlaygroundSchemaProvisioner } from '../infrastructure/playground-schema.provisioner';
import { TeardownExperimentSessionUseCase } from './teardown-experiment-session.usecase';

describe('TeardownExperimentSessionUseCase', () => {
  let getExperimentSession: jest.Mocked<GetExperimentSessionUseCase>;
  let sessionStore: jest.Mocked<ExperimentSessionStore>;
  let schemaProvisioner: jest.Mocked<PlaygroundSchemaProvisioner>;
  let cancelSessionJobs: jest.Mocked<CancelSessionJobsUseCase>;
  let useCase: TeardownExperimentSessionUseCase;

  const session = {
    sessionId: 'session-1',
    clientSessionToken: 'client-a',
    status: ExperimentSessionStatus.READY,
    trackSlug: 'database-sql',
    labSlug: 'index-playground',
    runtimeAdapter: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    schemaName: 'exp_abc123def456',
    dataset: {
      family: 'commerce',
      tier: '100k' as const,
      version: 'v1',
    },
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  beforeEach(() => {
    getExperimentSession = {
      execute: jest.fn().mockResolvedValue(session),
    } as unknown as jest.Mocked<GetExperimentSessionUseCase>;

    sessionStore = {
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ExperimentSessionStore>;

    schemaProvisioner = {
      dropSchema: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PlaygroundSchemaProvisioner>;

    cancelSessionJobs = {
      execute: jest.fn().mockResolvedValue({ cancelledCount: 0, jobIds: [] }),
    } as unknown as jest.Mocked<CancelSessionJobsUseCase>;

    useCase = new TeardownExperimentSessionUseCase(
      getExperimentSession,
      sessionStore,
      schemaProvisioner,
      cancelSessionJobs,
    );
  });

  it('drops schema and deletes session metadata', async () => {
    const result = await useCase.execute({ sessionId: 'session-1' });

    expect(result.sessionId).toBe('session-1');
    expect(result.status).toBe(ExperimentSessionStatus.EXPIRED);
    expect(cancelSessionJobs.execute).toHaveBeenCalledWith({
      sessionId: 'session-1',
      reason: 'SESSION_TEARDOWN',
    });
    expect(schemaProvisioner.dropSchema).toHaveBeenCalledWith(
      'exp_abc123def456',
    );
    expect(sessionStore.delete).toHaveBeenCalledWith(session);
  });

  it('continues teardown when cancel session jobs fails', async () => {
    cancelSessionJobs.execute.mockRejectedValue(new Error('cancel failed'));

    const result = await useCase.execute({ sessionId: 'session-1' });

    expect(result.status).toBe(ExperimentSessionStatus.EXPIRED);
    expect(schemaProvisioner.dropSchema).toHaveBeenCalledWith(
      'exp_abc123def456',
    );
    expect(sessionStore.delete).toHaveBeenCalledWith(session);
  });

  it('throws when teardown fails after marking failed state', async () => {
    schemaProvisioner.dropSchema.mockRejectedValue(new Error('drop failed'));

    await expect(
      useCase.execute({ sessionId: 'session-1' }),
    ).rejects.toMatchObject({
      code: ErrorCode.EXECUTION_ERROR,
      details: {
        reason: 'ISOLATION_TEARDOWN_FAILED',
      },
    });

    expect(cancelSessionJobs.execute).toHaveBeenCalledWith({
      sessionId: 'session-1',
      reason: 'SESSION_TEARDOWN',
    });
    expect(sessionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ExperimentSessionStatus.FAILED,
      }),
    );
  });
});
