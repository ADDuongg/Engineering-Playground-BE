import { JobFailureReason, JobStatus, JobType } from '@db-play/types';
import { DeadLetterLogger } from './dead-letter.logger';

describe('DeadLetterLogger', () => {
  it('emits structured job_dead_lettered event from a job', () => {
    const logger = new DeadLetterLogger();
    const emitSpy = jest.spyOn(logger, 'emit');

    logger.emitFromJob(
      {
        id: 'job-1',
        jobType: JobType.BENCHMARK,
        userId: 'user-1',
        sessionId: 'session-1',
        status: JobStatus.FAILED,
        createdAt: '2026-07-09T00:00:00.000Z',
        attemptCount: 2,
        maxAttempts: 2,
        failureMessage: 'k6 failed',
      },
      JobFailureReason.EXECUTION_ERROR,
    );

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        jobType: JobType.BENCHMARK,
        failureReason: JobFailureReason.EXECUTION_ERROR,
        attemptCount: 2,
        sessionId: 'session-1',
        userId: 'user-1',
      }),
    );
  });
});
