import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricHistoryResponse } from '@db-play/types';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';

export interface GetMetricHistoryInput {
  sessionId: string;
  labSlug?: string;
  limit?: number;
}

@Injectable()
export class GetMetricHistoryUseCase {
  constructor(
    private readonly repository: MetricSnapshotRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: GetMetricHistoryInput): Promise<MetricHistoryResponse> {
    const retentionLimit = this.configService.get<number>(
      'metrics.retentionLimit',
      50,
    );
    const limit = Math.min(input.limit ?? retentionLimit, retentionLimit);

    const snapshots = await this.repository.findHistory(
      input.sessionId,
      input.labSlug,
      limit,
    );

    return {
      snapshots: snapshots.map((snapshot) => ({
        runId: snapshot.id,
        runType: snapshot.runType as 'execution' | 'explain' | 'benchmark',
        createdAt: snapshot.createdAt.toISOString(),
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
