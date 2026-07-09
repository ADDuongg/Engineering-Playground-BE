import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BenchmarkMetricHistoryResponse,
  BenchmarkProfile,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';

export interface GetBenchmarkMetricHistoryInput {
  sessionId: string;
  labSlug?: string;
  limit?: number;
}

@Injectable()
export class GetBenchmarkMetricHistoryUseCase {
  constructor(
    private readonly repository: MetricSnapshotRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: GetBenchmarkMetricHistoryInput,
  ): Promise<BenchmarkMetricHistoryResponse> {
    if (!input.sessionId?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'sessionId is required.',
        400,
        { reason: 'SESSION_ID_REQUIRED' },
      );
    }

    const retentionLimit = this.configService.get<number>(
      'metrics.retentionLimit',
      50,
    );
    const limit = Math.min(input.limit ?? retentionLimit, retentionLimit);

    const snapshots = await this.repository.findHistory(
      input.sessionId,
      input.labSlug,
      limit,
      'benchmark',
    );

    return {
      snapshots: snapshots
        .filter((snapshot) => Boolean(snapshot.jobId))
        .map((snapshot) => ({
          runId: snapshot.id,
          jobId: snapshot.jobId as string,
          runType: 'benchmark' as const,
          createdAt: snapshot.createdAt.toISOString(),
          profile: (snapshot.profile ?? {
            rps: 0,
            durationSeconds: 0,
          }) as BenchmarkProfile,
          metrics: snapshot.metrics,
          dataset: {
            family: snapshot.datasetFamily,
            tier: snapshot.datasetTier,
            version: snapshot.datasetVersion,
          },
        })),
      retentionLimit,
    };
  }
}
