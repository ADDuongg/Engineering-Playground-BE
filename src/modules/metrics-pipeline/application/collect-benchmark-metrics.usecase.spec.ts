import {
  BenchmarkFinishedEvent,
  BenchmarkJobStatus,
  DatasetTier,
  JobStatus,
  JobType,
} from '@db-play/types';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { K6SummaryParser } from '../infrastructure/k6-summary.parser';
import { PersistMetricSnapshotUseCase } from './persist-metric-snapshot.usecase';
import { CollectBenchmarkMetricsUseCase } from './collect-benchmark-metrics.usecase';

describe('CollectBenchmarkMetricsUseCase', () => {
  let parser: jest.Mocked<K6SummaryParser>;
  let persist: jest.Mocked<PersistMetricSnapshotUseCase>;
  let jobStore: jest.Mocked<JobStore>;
  let useCase: CollectBenchmarkMetricsUseCase;

  const baseEvent: BenchmarkFinishedEvent = {
    jobId: 'job-1',
    sessionId: 'session-1',
    userId: 'user-1',
    status: BenchmarkJobStatus.COMPLETED,
    profile: { rps: 100, durationSeconds: 10 },
    k6Summary: { metrics: { ok: true } },
  };

  const metrics = [
    { key: 'latency_avg_ms', label: 'Average Latency', unit: 'ms', value: 10, group: 'latency' },
    { key: 'latency_p95_ms', label: 'P95 Latency', unit: 'ms', value: 20, group: 'latency' },
    { key: 'latency_p99_ms', label: 'P99 Latency', unit: 'ms', value: 30, group: 'latency' },
    { key: 'achieved_rps', label: 'Achieved RPS', unit: 'rps', value: 100, group: 'throughput' },
    { key: 'throughput_rps', label: 'Throughput', unit: 'rps', value: 95, group: 'throughput' },
    { key: 'error_rate_pct', label: 'Error Rate', unit: '%', value: 5, group: 'reliability' },
  ];

  beforeEach(() => {
    parser = {
      parse: jest.fn().mockReturnValue({ metrics, omittedMetricKeys: [] }),
    } as unknown as jest.Mocked<K6SummaryParser>;

    persist = {
      execute: jest.fn().mockResolvedValue({ runId: 'snap-1', persisted: true }),
    } as unknown as jest.Mocked<PersistMetricSnapshotUseCase>;

    jobStore = {
      getById: jest.fn().mockResolvedValue({
        id: 'job-1',
        jobType: JobType.BENCHMARK,
        userId: 'user-1',
        sessionId: 'session-1',
        status: JobStatus.COMPLETED,
        payloadSummary: {
          profile: baseEvent.profile,
          dataset: {
            family: 'commerce',
            tier: DatasetTier.TIER_100K,
            version: 'v1',
          },
          context: { labSlug: 'benchmark-lab', trackSlug: 'database-sql' },
        },
        createdAt: '2026-07-09T00:00:00.000Z',
        attemptCount: 1,
        maxAttempts: 2,
      }),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<JobStore>;

    useCase = new CollectBenchmarkMetricsUseCase(parser, persist, jobStore);
  });

  it('collects, persists, and embeds metrics on happy path', async () => {
    const result = await useCase.execute(baseEvent);

    expect(result.phase).toBe('completed');
    expect(result.metricsStatus).toBe('ready');
    expect(result.metrics).toHaveLength(6);
    expect(persist.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          runType: 'benchmark',
          jobId: 'job-1',
          profile: baseEvent.profile,
        }),
        metrics,
      }),
    );
    expect(jobStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadSummary: expect.objectContaining({
          metricsStatus: 'ready',
          runId: 'snap-1',
          metrics,
        }),
      }),
    );
  });

  it('marks unavailable when summary is malformed', async () => {
    parser.parse.mockImplementation(() => {
      throw new Error('Incomplete k6 summary');
    });

    const result = await useCase.execute(baseEvent);

    expect(result.phase).toBe('failed');
    expect(result.metricsStatus).toBe('unavailable');
    expect(jobStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadSummary: expect.objectContaining({
          metricsStatus: 'unavailable',
        }),
      }),
    );
  });

  it('skips non-completed jobs', async () => {
    const result = await useCase.execute({
      ...baseEvent,
      status: BenchmarkJobStatus.FAILED,
    });

    expect(result.phase).toBe('skipped');
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('is idempotent when persist returns existing snapshot', async () => {
    persist.execute.mockResolvedValue({ runId: 'snap-existing', persisted: true });

    const first = await useCase.execute(baseEvent);
    const second = await useCase.execute(baseEvent);

    expect(first.runId).toBe('snap-existing');
    expect(second.runId).toBe('snap-existing');
    expect(persist.execute).toHaveBeenCalledTimes(2);
  });

  it('returns failed phase with observability-friendly result when summary missing', async () => {
    const result = await useCase.execute({
      ...baseEvent,
      k6Summary: undefined,
    });

    expect(result.phase).toBe('failed');
    expect(result.metricsStatus).toBe('unavailable');
    expect(parser.parse).not.toHaveBeenCalled();
  });
});
