import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { MetricContract, MetricRunContext } from '@db-play/types';
import { MetricSnapshotRepository } from '../infrastructure/metric-snapshot.repository';

export interface PersistMetricSnapshotInput {
  context: MetricRunContext;
  metrics: MetricContract[];
  omittedMetricKeys?: string[];
}

export interface PersistMetricSnapshotResult {
  runId: string;
  persisted: boolean;
}

@Injectable()
export class PersistMetricSnapshotUseCase {
  private readonly logger = new Logger(PersistMetricSnapshotUseCase.name);

  constructor(
    private readonly repository: MetricSnapshotRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: PersistMetricSnapshotInput,
  ): Promise<PersistMetricSnapshotResult> {
    if (!input.context.sessionId) {
      return { runId: randomUUID(), persisted: false };
    }

    try {
      const snapshot = await this.repository.saveSnapshot({
        context: input.context,
        metrics: input.metrics,
        omittedMetricKeys: input.omittedMetricKeys,
      });

      const retentionLimit = this.configService.get<number>(
        'metrics.retentionLimit',
        50,
      );

      await this.repository.pruneRetention(
        input.context.sessionId,
        input.context.labSlug,
        retentionLimit,
      );

      this.logPersisted(input, snapshot.id, snapshot.metrics.length);

      return { runId: snapshot.id, persisted: true };
    } catch (error) {
      this.logger.warn({
        event: 'metric_snapshot_persisted',
        phase: 'failed',
        runType: input.context.runType,
        sessionId: input.context.sessionId,
        labSlug: input.context.labSlug,
        metricCount: input.metrics.length,
        omittedMetricCount: input.omittedMetricKeys?.length ?? 0,
        requestId: input.context.requestId,
        error: error instanceof Error ? error.message : 'unknown',
      });

      return { runId: randomUUID(), persisted: false };
    }
  }

  private logPersisted(
    input: PersistMetricSnapshotInput,
    runId: string,
    metricCount: number,
  ): void {
    this.logger.log({
      event: 'metric_snapshot_persisted',
      phase: 'completed',
      runType: input.context.runType,
      sessionId: input.context.sessionId,
      labSlug: input.context.labSlug,
      metricCount,
      omittedMetricCount: input.omittedMetricKeys?.length ?? 0,
      requestId: input.context.requestId,
      runId,
    });
  }
}
