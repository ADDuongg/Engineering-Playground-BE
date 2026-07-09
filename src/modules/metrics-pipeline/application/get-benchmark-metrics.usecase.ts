import { Injectable } from '@nestjs/common';
import {
  BackgroundJob,
  BenchmarkMetricsByJobResponse,
  BenchmarkMetricsStatus,
  BenchmarkProfile,
  ErrorCode,
  JobStatus,
  JobType,
  MetricContract,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';

export interface GetBenchmarkMetricsInput {
  jobId: string;
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class GetBenchmarkMetricsUseCase {
  constructor(
    private readonly jobStore: JobStore,
    private readonly repository: MetricSnapshotRepository,
  ) {}

  async execute(
    input: GetBenchmarkMetricsInput,
  ): Promise<BenchmarkMetricsByJobResponse> {
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

    const metricsStatus = this.resolveMetricsStatus(job);
    const snapshot = await this.repository.findByJobId(job.id);

    const metrics: MetricContract[] =
      metricsStatus === 'ready'
        ? (snapshot?.metrics ??
          (job.payloadSummary?.metrics as MetricContract[] | undefined) ??
          [])
        : [];

    return {
      jobId: job.id,
      runId: snapshot?.id ?? (job.payloadSummary?.runId as string | undefined),
      status: job.status,
      profile,
      metricsStatus,
      metrics,
      createdAt: snapshot?.createdAt.toISOString(),
      hint:
        metricsStatus === 'unavailable'
          ? ((job.payloadSummary?.metricsHint as string | undefined) ??
            'Benchmark metrics are unavailable for this run.')
          : metricsStatus === 'pending'
            ? 'Benchmark metrics are not ready yet.'
            : undefined,
    };
  }

  private resolveMetricsStatus(job: BackgroundJob): BenchmarkMetricsStatus {
    const fromPayload = job.payloadSummary?.metricsStatus as
      | BenchmarkMetricsStatus
      | undefined;

    if (fromPayload) {
      return fromPayload;
    }

    if (job.status === JobStatus.QUEUED || job.status === JobStatus.RUNNING) {
      return 'pending';
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
