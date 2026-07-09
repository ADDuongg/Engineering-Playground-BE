import {
  ErrorCode,
  JobStatus,
  JobType,
} from '@db-play/types';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';
import { GetBenchmarkMetricsUseCase } from './get-benchmark-metrics.usecase';

describe('GetBenchmarkMetricsUseCase', () => {
  let jobStore: jest.Mocked<JobStore>;
  let repository: jest.Mocked<MetricSnapshotRepository>;
  let useCase: GetBenchmarkMetricsUseCase;

  const metrics = [
    { key: 'achieved_rps', label: 'Achieved RPS', unit: 'rps', value: 100, group: 'throughput' },
  ];

  const completedJob = {
    id: 'job-1',
    jobType: JobType.BENCHMARK,
    userId: 'user-1',
    sessionId: 'session-1',
    status: JobStatus.COMPLETED,
    payloadSummary: {
      profile: { rps: 100, durationSeconds: 10 },
      metricsStatus: 'ready',
      metrics,
      runId: 'snap-1',
    },
    createdAt: '2026-07-09T00:00:00.000Z',
    attemptCount: 1,
    maxAttempts: 2,
  };

  beforeEach(() => {
    jobStore = {
      getById: jest.fn().mockResolvedValue(completedJob),
    } as unknown as jest.Mocked<JobStore>;

    repository = {
      findByJobId: jest.fn().mockResolvedValue({
        id: 'snap-1',
        metrics,
        createdAt: new Date('2026-07-09T00:00:10.000Z'),
      }),
    } as unknown as jest.Mocked<MetricSnapshotRepository>;

    useCase = new GetBenchmarkMetricsUseCase(jobStore, repository);
  });

  it('returns ready metrics from snapshot', async () => {
    const result = await useCase.execute({ jobId: 'job-1', userId: 'user-1' });
    expect(result.metricsStatus).toBe('ready');
    expect(result.metrics).toEqual(metrics);
    expect(result.runId).toBe('snap-1');
  });

  it('returns pending for running jobs', async () => {
    jobStore.getById.mockResolvedValue({
      ...completedJob,
      status: JobStatus.RUNNING,
      payloadSummary: {
        profile: { rps: 100, durationSeconds: 10 },
        metricsStatus: 'pending',
      },
    });

    const result = await useCase.execute({ jobId: 'job-1', userId: 'user-1' });
    expect(result.metricsStatus).toBe('pending');
    expect(result.metrics).toEqual([]);
  });

  it('returns unavailable when collection failed', async () => {
    jobStore.getById.mockResolvedValue({
      ...completedJob,
      payloadSummary: {
        profile: { rps: 100, durationSeconds: 10 },
        metricsStatus: 'unavailable',
        metricsHint: 'Incomplete k6 summary',
      },
    });
    repository.findByJobId.mockResolvedValue(null);

    const result = await useCase.execute({ jobId: 'job-1', userId: 'user-1' });
    expect(result.metricsStatus).toBe('unavailable');
    expect(result.hint).toContain('Incomplete');
  });

  it('forbids other users', async () => {
    await expect(
      useCase.execute({ jobId: 'job-1', userId: 'other' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('rejects unknown jobs', async () => {
    jobStore.getById.mockResolvedValue(null);
    await expect(
      useCase.execute({ jobId: 'missing', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
