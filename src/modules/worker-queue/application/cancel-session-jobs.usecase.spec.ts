import { JobStatus, JobType } from '@db-play/types';
import { JobStore } from '../infrastructure/job.store';
import { JobQueueProducer } from '../infrastructure/job-queue.producer';
import { CancelSessionJobsUseCase } from './cancel-session-jobs.usecase';

describe('CancelSessionJobsUseCase', () => {
  let useCase: CancelSessionJobsUseCase;
  let jobStore: jest.Mocked<Pick<JobStore, 'listBySession' | 'markCancelled'>>;
  let queueProducer: jest.Mocked<Pick<JobQueueProducer, 'remove'>>;

  beforeEach(() => {
    jobStore = {
      listBySession: jest.fn(),
      markCancelled: jest.fn(async (job) => ({
        ...job,
        status: JobStatus.CANCELLED,
      })),
    };
    queueProducer = {
      remove: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CancelSessionJobsUseCase(
      jobStore as unknown as JobStore,
      queueProducer as unknown as JobQueueProducer,
    );
  });

  it('cancels inflight jobs for a session', async () => {
    jobStore.listBySession.mockResolvedValue([
      {
        id: 'job-1',
        jobType: JobType.DATASET_RESET,
        userId: 'user-1',
        sessionId: 'session-1',
        status: JobStatus.QUEUED,
        createdAt: '2026-07-09T00:00:00.000Z',
        attemptCount: 0,
        maxAttempts: 3,
      },
      {
        id: 'job-2',
        jobType: JobType.BENCHMARK,
        userId: 'user-1',
        sessionId: 'session-1',
        status: JobStatus.COMPLETED,
        createdAt: '2026-07-09T00:00:00.000Z',
        attemptCount: 1,
        maxAttempts: 2,
      },
    ]);

    const result = await useCase.execute({
      sessionId: 'session-1',
      reason: 'SESSION_TEARDOWN',
    });

    expect(result.cancelledCount).toBe(1);
    expect(result.jobIds).toEqual(['job-1']);
    expect(queueProducer.remove).toHaveBeenCalledWith(
      JobType.DATASET_RESET,
      'job-1',
    );
    expect(jobStore.markCancelled).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight sql-execution job on session teardown', async () => {
    jobStore.listBySession.mockResolvedValue([
      {
        id: 'sql-1',
        jobType: JobType.SQL_EXECUTION,
        userId: 'user-1',
        sessionId: 'session-1',
        status: JobStatus.RUNNING,
        createdAt: '2026-07-09T00:00:00.000Z',
        attemptCount: 1,
        maxAttempts: 2,
      },
    ]);

    const result = await useCase.execute({
      sessionId: 'session-1',
      reason: 'SESSION_TEARDOWN',
    });

    expect(result.cancelledCount).toBe(1);
    expect(queueProducer.remove).toHaveBeenCalledWith(
      JobType.SQL_EXECUTION,
      'sql-1',
    );
    expect(jobStore.markCancelled).toHaveBeenCalledTimes(1);
  });
});
