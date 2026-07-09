import { BenchmarkFinishedEvent, BenchmarkJobStatus } from '@db-play/types';
import { CollectBenchmarkMetricsUseCase } from '../application/collect-benchmark-metrics.usecase';
import { BenchmarkFinishedListener } from './benchmark-finished.listener';

describe('BenchmarkFinishedListener', () => {
  it('invokes collect on completed events', async () => {
    const collect = {
      execute: jest.fn().mockResolvedValue({ phase: 'completed' }),
    } as unknown as CollectBenchmarkMetricsUseCase;

    const listener = new BenchmarkFinishedListener(collect);
    const event: BenchmarkFinishedEvent = {
      jobId: 'job-1',
      sessionId: 'session-1',
      userId: null,
      status: BenchmarkJobStatus.COMPLETED,
      profile: { rps: 100, durationSeconds: 10 },
      k6Summary: {},
    };

    await listener.handle(event);

    expect(collect.execute).toHaveBeenCalledWith(event);
  });

  it('still forwards failed events (collect decides skip)', async () => {
    const collect = {
      execute: jest.fn().mockResolvedValue({ phase: 'skipped' }),
    } as unknown as CollectBenchmarkMetricsUseCase;

    const listener = new BenchmarkFinishedListener(collect);
    await listener.handle({
      jobId: 'job-2',
      sessionId: 'session-1',
      userId: null,
      status: BenchmarkJobStatus.FAILED,
      profile: { rps: 100, durationSeconds: 10 },
    });

    expect(collect.execute).toHaveBeenCalled();
  });
});
