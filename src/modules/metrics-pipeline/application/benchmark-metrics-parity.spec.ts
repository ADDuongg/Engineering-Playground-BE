import {
  JobStatus,
  JobType,
  MetricContract,
} from '@db-play/types';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';
import { GetBenchmarkMetricsUseCase } from './get-benchmark-metrics.usecase';
import { GetBenchmarkStatusUseCase } from '../../benchmark-runner/application/get-benchmark-status.usecase';

describe('Benchmark metrics status/metrics parity (FR-017)', () => {
  it('returns the same Metric Contract values on status and metrics-by-job', async () => {
    const metrics: MetricContract[] = [
      {
        key: 'latency_avg_ms',
        label: 'Average Latency',
        unit: 'ms',
        value: 12,
        group: 'latency',
      },
      {
        key: 'achieved_rps',
        label: 'Achieved RPS',
        unit: 'rps',
        value: 100,
        group: 'throughput',
      },
    ];

    const job = {
      id: 'job-parity',
      jobType: JobType.BENCHMARK,
      userId: 'user-1',
      sessionId: 'session-1',
      status: JobStatus.COMPLETED,
      payloadSummary: {
        profile: { rps: 100, durationSeconds: 10 },
        metricsStatus: 'ready',
        metrics,
        runId: 'snap-parity',
      },
      createdAt: '2026-07-09T00:00:00.000Z',
      completedAt: '2026-07-09T00:00:10.000Z',
      attemptCount: 1,
      maxAttempts: 2,
    };

    const jobStore = {
      getById: jest.fn().mockResolvedValue(job),
    } as unknown as JobStore;

    const repository = {
      findByJobId: jest.fn().mockResolvedValue({
        id: 'snap-parity',
        metrics,
        createdAt: new Date('2026-07-09T00:00:10.000Z'),
      }),
    } as unknown as MetricSnapshotRepository;

    const statusUseCase = new GetBenchmarkStatusUseCase(jobStore);
    const metricsUseCase = new GetBenchmarkMetricsUseCase(jobStore, repository);

    const status = await statusUseCase.execute({
      jobId: 'job-parity',
      userId: 'user-1',
    });
    const byJob = await metricsUseCase.execute({
      jobId: 'job-parity',
      userId: 'user-1',
    });

    expect(status.metrics).toEqual(byJob.metrics);
    expect(status.metricsStatus).toBe(byJob.metricsStatus);
  });
});
