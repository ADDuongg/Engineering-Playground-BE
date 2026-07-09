import { ConfigService } from '@nestjs/config';
import { GetMetricHistoryUseCase } from './get-metric-history.usecase';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';

describe('GetMetricHistoryUseCase', () => {
  let repository: jest.Mocked<MetricSnapshotRepository>;
  let configService: jest.Mocked<ConfigService>;
  let useCase: GetMetricHistoryUseCase;

  beforeEach(() => {
    repository = {
      findHistory: jest.fn().mockResolvedValue([
        {
          id: 'run-1',
          runType: 'execution',
          createdAt: new Date('2026-07-08T10:00:00.000Z'),
          metrics: [],
          datasetFamily: 'commerce',
          datasetTier: '100k',
          datasetVersion: 'v1',
        },
        {
          id: 'run-2',
          runType: 'explain',
          createdAt: new Date('2026-07-08T10:01:00.000Z'),
          metrics: [],
          datasetFamily: 'commerce',
          datasetTier: '100k',
          datasetVersion: 'v1',
        },
      ]),
    } as unknown as jest.Mocked<MetricSnapshotRepository>;

    configService = {
      get: jest.fn().mockReturnValue(50),
    } as unknown as jest.Mocked<ConfigService>;

    useCase = new GetMetricHistoryUseCase(repository, configService);
  });

  it('returns snapshots in chronological order with retention limit', async () => {
    const result = await useCase.execute({
      sessionId: 'session-1',
      labSlug: 'index-playground',
    });

    expect(result.retentionLimit).toBe(50);
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].runId).toBe('run-1');
    expect(result.snapshots[1].runId).toBe('run-2');
    expect(repository.findHistory).toHaveBeenCalledWith(
      'session-1',
      'index-playground',
      50,
    );
  });

  it('caps requested limit to retention limit', async () => {
    await useCase.execute({
      sessionId: 'session-1',
      limit: 100,
    });

    expect(repository.findHistory).toHaveBeenCalledWith(
      'session-1',
      undefined,
      50,
    );
  });
});
