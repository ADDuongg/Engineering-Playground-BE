import { Injectable } from '@nestjs/common';
import {
  BenchmarkFailureReason,
  BenchmarkJobStatus,
  BenchmarkJobStatusResult,
  BenchmarkMetricsStatus,
  BenchmarkProfile,
  ErrorCode,
  JobStatus,
  JobType,
  MetricContract,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobStore } from '../../worker-queue/infrastructure/job.store';

export interface GetBenchmarkStatusInput {
  jobId: string;
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class GetBenchmarkStatusUseCase {
  constructor(private readonly jobStore: JobStore) {}

  async execute(input: GetBenchmarkStatusInput): Promise<BenchmarkJobStatusResult> {
    const job = await this.jobStore.getById(input.jobId);

    if (!job || job.jobType !== JobType.BENCHMARK) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Benchmark job was not found.',
        404,
        {
          reason: 'BENCHMARK_JOB_NOT_FOUND',
          hint: 'Verify the job identifier or start a new benchmark.',
        },
      );
    }

    this.assertOwnership(job.userId, job.sessionId, input.userId, input.sessionId);

    const profile = job.payloadSummary?.profile as BenchmarkProfile | undefined;

    if (!profile) {
      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        'Benchmark job is missing profile metadata.',
        500,
        { reason: 'BENCHMARK_JOB_CORRUPT' },
      );
    }

    const status = job.status as unknown as BenchmarkJobStatus;
    const metricsStatus = this.resolveMetricsStatus(job.status, job.payloadSummary);
    const metrics =
      metricsStatus === 'ready'
        ? ((job.payloadSummary?.metrics as MetricContract[] | undefined) ?? [])
        : undefined;

    return {
      jobId: job.id,
      status,
      profile,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failureReason: job.failureReason as BenchmarkFailureReason | undefined,
      hint: job.failureMessage,
      metricsStatus,
      metrics,
      runId: job.payloadSummary?.runId as string | undefined,
    };
  }

  private resolveMetricsStatus(
    status: JobStatus,
    payloadSummary?: Record<string, unknown>,
  ): BenchmarkMetricsStatus {
    const fromPayload = payloadSummary?.metricsStatus as
      | BenchmarkMetricsStatus
      | undefined;

    if (fromPayload) {
      return fromPayload;
    }

    if (status === JobStatus.QUEUED || status === JobStatus.RUNNING) {
      return 'pending';
    }

    if (status === JobStatus.COMPLETED) {
      return 'unavailable';
    }

    return 'unavailable';
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
      'You do not have access to this benchmark job.',
      403,
      { reason: 'BENCHMARK_JOB_FORBIDDEN' },
    );
  }
}
