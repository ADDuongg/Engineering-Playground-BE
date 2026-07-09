import { ConfigService } from '@nestjs/config';
import {
  DatasetTier,
  MetricCatalogId,
  MetricContract,
} from '@db-play/types';
import { PersistMetricSnapshotUseCase } from './persist-metric-snapshot.usecase';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';

describe('PersistMetricSnapshotUseCase', () => {
  const metrics: MetricContract[] = [
    {
      key: 'execution_time_ms',
      label: 'Execution Time',
      unit: 'ms',
      value: 12,
      group: 'performance',
    },
  ];

  let repository: jest.Mocked<MetricSnapshotRepository>;
  let configService: jest.Mocked<ConfigService>;
  let useCase: PersistMetricSnapshotUseCase;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const context = {
    sessionId: 'session-1',
    labSlug: 'index-playground',
    trackSlug: 'database-sql',
    requestId: 'req-1',
    runType: 'execution' as const,
    metricCatalogId: MetricCatalogId.DATABASE,
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
  };

  beforeEach(() => {
    repository = {
      saveSnapshot: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        metrics,
      }),
      pruneRetention: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MetricSnapshotRepository>;

    configService = {
      get: jest.fn().mockReturnValue(50),
    } as unknown as jest.Mocked<ConfigService>;

    useCase = new PersistMetricSnapshotUseCase(repository, configService);

    logSpy = jest.spyOn(
      (useCase as unknown as { logger: { log: (payload: unknown) => void } })
        .logger,
      'log',
    );
    warnSpy = jest.spyOn(
      (useCase as unknown as { logger: { warn: (payload: unknown) => void } })
        .logger,
      'warn',
    );
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('persists snapshot and prunes retention when sessionId is present', async () => {
    const result = await useCase.execute({
      context,
      metrics,
      omittedMetricKeys: ['rows_scanned'],
    });

    expect(result).toEqual({ runId: 'snapshot-1', persisted: true });
    expect(repository.saveSnapshot).toHaveBeenCalled();
    expect(repository.pruneRetention).toHaveBeenCalledWith(
      'session-1',
      'index-playground',
      50,
    );
  });

  it('returns ephemeral runId when sessionId is missing', async () => {
    const result = await useCase.execute({
      context: { ...context, sessionId: undefined },
      metrics,
    });

    expect(result.persisted).toBe(false);
    expect(result.runId).toBeDefined();
    expect(repository.saveSnapshot).not.toHaveBeenCalled();
  });

  it('emits audit log without SQL or row payloads', async () => {
    await useCase.execute({ context, metrics });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'metric_snapshot_persisted',
        phase: 'completed',
        metricCount: 1,
        runId: 'snapshot-1',
      }),
    );
    expect(logSpy.mock.calls[0][0]).not.toHaveProperty('sql');
    expect(logSpy.mock.calls[0][0]).not.toHaveProperty('rows');
  });

  it('logs failure and returns ephemeral runId when persistence fails', async () => {
    repository.saveSnapshot.mockRejectedValue(new Error('db down'));

    const result = await useCase.execute({ context, metrics });

    expect(result.persisted).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'metric_snapshot_persisted',
        phase: 'failed',
      }),
    );
  });
});
