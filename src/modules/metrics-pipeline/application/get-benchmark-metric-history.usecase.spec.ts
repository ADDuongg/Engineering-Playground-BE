import { ConfigService } from '@nestjs/config';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';
import { GetBenchmarkMetricHistoryUseCase } from './get-benchmark-metric-history.usecase';

describe('GetBenchmarkMetricHistoryUseCase', () => {
  it('returns benchmark snapshots ordered ascending', async () => {
    const repository = {
      findHistory: jest.fn().mockResolvedValue([
        {
          id: 's1',
          jobId: 'j1',
          createdAt: new Date('2026-07-09T00:00:00.000Z'),
          profile: { rps: 100, durationSeconds: 10 },
          metrics: [{ key: 'achieved_rps', label: 'Achieved RPS', unit: 'rps', value: 90, group: 'throughput' }],
          datasetFamily: 'commerce',
          datasetTier: '100k',
          datasetVersion: 'v1',
        },
        {
          id: 's2',
          jobId: 'j2',
          createdAt: new Date('2026-07-09T00:01:00.000Z'),
          profile: { rps: 100, durationSeconds: 10 },
          metrics: [{ key: 'achieved_rps', label: 'Achieved RPS', unit: 'rps', value: 95, group: 'throughput' }],
          datasetFamily: 'commerce',
          datasetTier: '100k',
          datasetVersion: 'v1',
        },
      ]),
    } as unknown as MetricSnapshotRepository;

    const config = {
      get: jest.fn().mockReturnValue(50),
    } as unknown as ConfigService;

    const useCase = new GetBenchmarkMetricHistoryUseCase(repository, config);
    const result = await useCase.execute({ sessionId: 'session-1', labSlug: 'benchmark-lab' });

    expect(repository.findHistory).toHaveBeenCalledWith(
      'session-1',
      'benchmark-lab',
      50,
      'benchmark',
    );
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].jobId).toBe('j1');
    expect(result.snapshots[1].metrics[0].value).toBe(95);
  });
});
