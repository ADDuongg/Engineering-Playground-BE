import { ConfigService } from '@nestjs/config';
import {
  BackgroundJob,
  JobStatus,
  JobType,
} from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';
import { JobStore } from './job.store';

describe('JobStore', () => {
  let store: JobStore;
  let redisClient: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    sadd: jest.Mock;
    srem: jest.Mock;
    smembers: jest.Mock;
    expire: jest.Mock;
  };

  const baseJob: BackgroundJob = {
    id: 'job-1',
    jobType: JobType.DATASET_RESET,
    userId: 'user-1',
    sessionId: 'session-1',
    status: JobStatus.QUEUED,
    createdAt: '2026-07-09T00:00:00.000Z',
    attemptCount: 0,
    maxAttempts: 3,
  };

  beforeEach(() => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
    };

    const redisService = {
      getClient: () => redisClient,
    } as unknown as RedisService;

    const configService = {
      get: jest.fn().mockReturnValue(86400),
    } as unknown as ConfigService;

    store = new JobStore(redisService, configService);
  });

  it('persists jobs and indexes by session', async () => {
    await store.save(baseJob);

    expect(redisClient.set).toHaveBeenCalledWith(
      'jobs:status:job-1',
      JSON.stringify(baseJob),
      'EX',
      86400,
    );
    expect(redisClient.sadd).toHaveBeenCalledWith(
      'jobs:session:session-1',
      'job-1',
    );
  });

  it('marks running and increments attemptCount', async () => {
    redisClient.get.mockResolvedValue(JSON.stringify(baseJob));

    const running = await store.markRunning(baseJob);

    expect(running.status).toBe(JobStatus.RUNNING);
    expect(running.attemptCount).toBe(1);
    expect(running.startedAt).toBeDefined();
  });

  it('clears prior failure fields when marking running for retry', async () => {
    const failedJob: BackgroundJob = {
      ...baseJob,
      status: JobStatus.FAILED,
      attemptCount: 1,
      completedAt: '2026-07-09T00:01:00.000Z',
      failureReason: 'EXECUTION_ERROR' as BackgroundJob['failureReason'],
      failureMessage: 'temporary',
    };
    redisClient.get.mockResolvedValue(JSON.stringify(failedJob));

    const running = await store.markRunning(failedJob);

    expect(running.status).toBe(JobStatus.RUNNING);
    expect(running.attemptCount).toBe(2);
    expect(running.completedAt).toBeUndefined();
    expect(running.failureReason).toBeUndefined();
    expect(running.failureMessage).toBeUndefined();
  });

  it('counts inflight jobs for a session', async () => {
    redisClient.smembers.mockResolvedValue(['job-1']);
    redisClient.get.mockResolvedValue(JSON.stringify(baseJob));

    await expect(store.countInflightBySession('session-1')).resolves.toBe(1);
  });

  it('deletes job and removes session index', async () => {
    redisClient.get.mockResolvedValue(JSON.stringify(baseJob));

    await store.delete('job-1');

    expect(redisClient.del).toHaveBeenCalledWith('jobs:status:job-1');
    expect(redisClient.srem).toHaveBeenCalledWith(
      'jobs:session:session-1',
      'job-1',
    );
  });
});
