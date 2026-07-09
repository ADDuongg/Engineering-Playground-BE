import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  GetJobStatusResult,
  toJobStatusResult,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobStore } from '../infrastructure/job.store';

export interface GetJobStatusInput {
  jobId: string;
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class GetJobStatusUseCase {
  constructor(private readonly jobStore: JobStore) {}

  async execute(input: GetJobStatusInput): Promise<GetJobStatusResult> {
    const job = await this.jobStore.getById(input.jobId);

    if (!job) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Job was not found.',
        404,
        {
          reason: 'JOB_NOT_FOUND',
          hint: 'Verify the job identifier or start a new job.',
        },
      );
    }

    this.assertOwnership(job.userId, job.sessionId, input.userId, input.sessionId);

    return toJobStatusResult(job);
  }

  private assertOwnership(
    jobUserId: string | null,
    jobSessionId: string | null,
    callerUserId?: string,
    callerSessionId?: string,
  ): void {
    if (callerUserId && jobUserId && callerUserId === jobUserId) {
      return;
    }

    if (callerSessionId && jobSessionId && callerSessionId === jobSessionId) {
      return;
    }

    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'You do not have access to this job.',
      403,
      { reason: 'JOB_FORBIDDEN' },
    );
  }
}
