import { ConfigService } from '@nestjs/config';
import { JobType } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobQueueProducer } from './job-queue.producer';

const mockAdd = jest.fn();
const mockClose = jest.fn();
const mockGetJob = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockAdd,
    close: mockClose,
    getJob: mockGetJob,
  })),
}));

describe('JobQueueProducer', () => {
  let producer: JobQueueProducer;

  beforeEach(() => {
    mockAdd.mockReset().mockResolvedValue(undefined);
    mockClose.mockReset().mockResolvedValue(undefined);
    mockGetJob.mockReset();

    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          'redis.host': 'localhost',
          'redis.port': 6379,
          'redis.password': undefined,
          'benchmark.queueName': 'benchmark-jobs',
          'benchmark.maxAttempts': 2,
          'benchmark.backoffDelayMs': 2000,
          'datasetReset.queueName': 'dataset-reset-jobs',
          'datasetReset.maxAttempts': 3,
          'datasetReset.backoffDelayMs': 2000,
          'sqlExecution.queueName': 'sql-execution-jobs',
          'sqlExecution.maxAttempts': 2,
          'sqlExecution.backoffDelayMs': 1000,
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    producer = new JobQueueProducer(configService);
  });

  afterEach(async () => {
    await producer.onModuleDestroy();
  });

  it('enqueues to the queue for the job type', async () => {
    await producer.enqueue({
      jobId: 'job-1',
      jobType: JobType.DATASET_RESET,
      sessionId: 'session-1',
      userId: 'user-1',
      body: { family: 'commerce' },
    });

    expect(mockAdd).toHaveBeenCalledWith(
      'run',
      expect.objectContaining({
        jobId: 'job-1',
        jobType: JobType.DATASET_RESET,
      }),
      { jobId: 'job-1' },
    );
  });

  it('maps enqueue failures to QUEUE_UNAVAILABLE', async () => {
    mockAdd.mockRejectedValue(new Error('redis down'));

    await expect(
      producer.enqueue({
        jobId: 'job-1',
        jobType: JobType.BENCHMARK,
        sessionId: 'session-1',
        userId: null,
        body: {},
      }),
    ).rejects.toBeInstanceOf(DomainError);

    try {
      await producer.enqueue({
        jobId: 'job-1',
        jobType: JobType.BENCHMARK,
        sessionId: 'session-1',
        userId: null,
        body: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).details).toEqual(
        expect.objectContaining({ reason: 'QUEUE_UNAVAILABLE' }),
      );
      expect((error as DomainError).statusCode).toBe(503);
    }
  });

  it('returns per-type max attempts from config', () => {
    expect(producer.getMaxAttempts(JobType.BENCHMARK)).toBe(2);
    expect(producer.getMaxAttempts(JobType.DATASET_RESET)).toBe(3);
    expect(producer.getMaxAttempts(JobType.SQL_EXECUTION)).toBe(2);
  });

  it('resolves the dedicated queue name for sql-execution jobs', async () => {
    await producer.enqueue({
      jobId: 'sql-1',
      jobType: JobType.SQL_EXECUTION,
      sessionId: 'session-1',
      userId: 'user-1',
      body: { sql: 'SELECT 1' },
    });

    expect(producer.getQueueName(JobType.SQL_EXECUTION)).toBe(
      'sql-execution-jobs',
    );
    expect(mockAdd).toHaveBeenCalledWith(
      'run',
      expect.objectContaining({ jobType: JobType.SQL_EXECUTION }),
      { jobId: 'sql-1' },
    );
  });
});
