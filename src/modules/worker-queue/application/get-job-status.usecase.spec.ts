import { ErrorCode, JobStatus, JobType } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobStore } from '../infrastructure/job.store';
import { GetJobStatusUseCase } from './get-job-status.usecase';

describe('GetJobStatusUseCase', () => {
  let useCase: GetJobStatusUseCase;
  let jobStore: jest.Mocked<JobStore>;

  beforeEach(() => {
    jobStore = {
      getById: jest.fn(),
    } as unknown as jest.Mocked<JobStore>;

    useCase = new GetJobStatusUseCase(jobStore);
  });

  it('returns status for the owning user', async () => {
    jobStore.getById.mockResolvedValue({
      id: 'job-1',
      jobType: JobType.DATASET_RESET,
      userId: 'user-1',
      sessionId: 'session-1',
      status: JobStatus.QUEUED,
      createdAt: '2026-07-09T00:00:00.000Z',
      attemptCount: 0,
      maxAttempts: 3,
    });

    const result = await useCase.execute({
      jobId: 'job-1',
      userId: 'user-1',
    });

    expect(result.jobId).toBe('job-1');
    expect(result.status).toBe(JobStatus.QUEUED);
  });

  it('rejects access for other users', async () => {
    jobStore.getById.mockResolvedValue({
      id: 'job-1',
      jobType: JobType.BENCHMARK,
      userId: 'user-1',
      sessionId: 'session-1',
      status: JobStatus.QUEUED,
      createdAt: '2026-07-09T00:00:00.000Z',
      attemptCount: 0,
      maxAttempts: 2,
    });

    await expect(
      useCase.execute({ jobId: 'job-1', userId: 'user-2' }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('throws NOT_FOUND when job is missing', async () => {
    jobStore.getById.mockResolvedValue(null);

    await expect(useCase.execute({ jobId: 'missing' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});
