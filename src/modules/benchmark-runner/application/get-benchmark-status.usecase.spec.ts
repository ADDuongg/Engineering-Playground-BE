import {
  BenchmarkFailureReason,
  BenchmarkJobStatus,
  ErrorCode,
  JobFailureReason,
  JobStatus,
  JobType,
} from '@db-play/types';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { GetBenchmarkStatusUseCase } from './get-benchmark-status.usecase';

describe('GetBenchmarkStatusUseCase', () => {
  let jobStore: jest.Mocked<JobStore>;
  let useCase: GetBenchmarkStatusUseCase;

  const job = {
    id: 'job-1',
    jobType: JobType.BENCHMARK,
    userId: 'user-1',
    sessionId: 'session-1',
    status: JobStatus.COMPLETED,
    payloadSummary: {
      profile: { rps: 100, durationSeconds: 10 },
      dataset: { family: 'commerce', tier: '100k', version: 'v1' },
    },
    createdAt: '2026-07-08T00:00:00.000Z',
    completedAt: '2026-07-08T00:00:10.000Z',
    attemptCount: 1,
    maxAttempts: 2,
  };

  beforeEach(() => {
    jobStore = {
      getById: jest.fn(),
    } as unknown as jest.Mocked<JobStore>;

    useCase = new GetBenchmarkStatusUseCase(jobStore);
  });

  it('returns lifecycle status for the owning user', async () => {
    jobStore.getById.mockResolvedValue(job);

    const result = await useCase.execute({
      jobId: 'job-1',
      userId: 'user-1',
    });

    expect(result.status).toBe(BenchmarkJobStatus.COMPLETED);
    expect(result.profile).toEqual({ rps: 100, durationSeconds: 10 });
    expect(result.completedAt).toBeDefined();
    expect(result.metricsStatus).toBe('unavailable');
  });

  it('embeds ready metrics from payloadSummary', async () => {
    const metrics = [
      {
        key: 'achieved_rps',
        label: 'Achieved RPS',
        unit: 'rps',
        value: 100,
        group: 'throughput',
      },
    ];
    jobStore.getById.mockResolvedValue({
      ...job,
      payloadSummary: {
        ...job.payloadSummary,
        metricsStatus: 'ready',
        metrics,
        runId: 'snap-1',
      },
    });

    const result = await useCase.execute({
      jobId: 'job-1',
      userId: 'user-1',
    });

    expect(result.metricsStatus).toBe('ready');
    expect(result.metrics).toEqual(metrics);
    expect(result.runId).toBe('snap-1');
  });

  it('returns pending metricsStatus for running jobs', async () => {
    jobStore.getById.mockResolvedValue({
      ...job,
      status: JobStatus.RUNNING,
      payloadSummary: {
        ...job.payloadSummary,
        metricsStatus: 'pending',
      },
    });

    const result = await useCase.execute({
      jobId: 'job-1',
      userId: 'user-1',
    });

    expect(result.metricsStatus).toBe('pending');
    expect(result.metrics).toBeUndefined();
  });

  it('allows session-scoped access for session-owned jobs', async () => {
    jobStore.getById.mockResolvedValue({
      ...job,
      userId: null,
    });

    const result = await useCase.execute({
      jobId: 'job-1',
      sessionId: 'session-1',
    });

    expect(result.status).toBe(BenchmarkJobStatus.COMPLETED);
  });

  it('forbids access for a different user', async () => {
    jobStore.getById.mockResolvedValue(job);

    await expect(
      useCase.execute({ jobId: 'job-1', userId: 'other-user' }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('returns failed jobs with reason hints', async () => {
    jobStore.getById.mockResolvedValue({
      ...job,
      status: JobStatus.FAILED,
      failureReason: JobFailureReason.EXECUTION_ERROR,
      failureMessage: 'k6 failed',
    });

    const result = await useCase.execute({
      jobId: 'job-1',
      userId: 'user-1',
    });

    expect(result.failureReason).toBe(BenchmarkFailureReason.EXECUTION_ERROR);
    expect(result.hint).toBe('k6 failed');
  });

  it('rejects non-benchmark jobs', async () => {
    jobStore.getById.mockResolvedValue({
      ...job,
      jobType: JobType.DATASET_RESET,
    });

    await expect(
      useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
