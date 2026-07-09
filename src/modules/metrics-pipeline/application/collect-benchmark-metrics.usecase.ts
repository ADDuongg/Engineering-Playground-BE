import { Injectable, Logger } from '@nestjs/common';
import {
  BackgroundJob,
  BenchmarkFinishedEvent,
  BenchmarkJobStatus,
  BenchmarkMetricsStatus,
  DatasetTier,
  MetricContract,
  MetricRunContext,
} from '@db-play/types';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { K6SummaryParser } from '../infrastructure/k6-summary.parser';
import { PersistMetricSnapshotUseCase } from './persist-metric-snapshot.usecase';

export interface CollectBenchmarkMetricsResult {
  metricsStatus: BenchmarkMetricsStatus;
  metrics: MetricContract[];
  runId?: string;
  phase: 'completed' | 'failed' | 'skipped';
}

@Injectable()
export class CollectBenchmarkMetricsUseCase {
  private readonly logger = new Logger(CollectBenchmarkMetricsUseCase.name);

  constructor(
    private readonly parser: K6SummaryParser,
    private readonly persistMetricSnapshot: PersistMetricSnapshotUseCase,
    private readonly jobStore: JobStore,
  ) {}

  async execute(
    event: BenchmarkFinishedEvent,
  ): Promise<CollectBenchmarkMetricsResult> {
    if (event.status !== BenchmarkJobStatus.COMPLETED) {
      this.logger.log({
        event: 'benchmark_metrics_collected',
        phase: 'skipped',
        jobId: event.jobId,
        sessionId: event.sessionId,
        reason: 'job_not_completed',
        profile: event.profile,
      });
      return {
        metricsStatus: 'unavailable',
        metrics: [],
        phase: 'skipped',
      };
    }

    if (!event.k6Summary) {
      await this.markUnavailable(event.jobId, 'missing_k6_summary');
      this.logger.warn({
        event: 'benchmark_metrics_collected',
        phase: 'failed',
        jobId: event.jobId,
        sessionId: event.sessionId,
        reason: 'missing_k6_summary',
        profile: event.profile,
      });
      return {
        metricsStatus: 'unavailable',
        metrics: [],
        phase: 'failed',
      };
    }

    try {
      const job = await this.jobStore.getById(event.jobId);
      const dataset = this.resolveDataset(job, event);
      const context = this.buildContext(event, job, dataset);

      const { metrics, omittedMetricKeys } = this.parser.parse(event.k6Summary);

      const persisted = await this.persistMetricSnapshot.execute({
        context,
        metrics,
        omittedMetricKeys,
      });

      await this.updateJobPayload(event.jobId, {
        metricsStatus: 'ready',
        metrics,
        runId: persisted.runId,
      });

      this.logger.log({
        event: 'benchmark_metrics_collected',
        phase: 'completed',
        jobId: event.jobId,
        sessionId: event.sessionId,
        metricCount: metrics.length,
        profile: event.profile,
        runId: persisted.runId,
      });

      return {
        metricsStatus: 'ready',
        metrics,
        runId: persisted.runId,
        phase: 'completed',
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'collection_failed';
      await this.markUnavailable(event.jobId, reason);
      this.logger.warn({
        event: 'benchmark_metrics_collected',
        phase: 'failed',
        jobId: event.jobId,
        sessionId: event.sessionId,
        reason,
        profile: event.profile,
      });
      return {
        metricsStatus: 'unavailable',
        metrics: [],
        phase: 'failed',
      };
    }
  }

  private buildContext(
    event: BenchmarkFinishedEvent,
    job: BackgroundJob | null,
    dataset: MetricRunContext['dataset'],
  ): MetricRunContext {
    const payload = job?.payloadSummary ?? {};
    const contextPayload =
      (payload.context as
        | { trackSlug?: string; labSlug?: string; requestId?: string }
        | undefined) ?? {};

    return {
      sessionId: event.sessionId,
      userId: event.userId ?? undefined,
      trackSlug: contextPayload.trackSlug,
      labSlug: contextPayload.labSlug,
      requestId: contextPayload.requestId ?? event.jobId,
      runType: 'benchmark',
      dataset,
      jobId: event.jobId,
      profile: event.profile,
    };
  }

  private resolveDataset(
    job: BackgroundJob | null,
    event: BenchmarkFinishedEvent,
  ): MetricRunContext['dataset'] {
    const fromPayload = job?.payloadSummary?.dataset as
      | { family?: string; tier?: string; version?: string }
      | undefined;

    return {
      family: fromPayload?.family ?? 'commerce',
      tier: (fromPayload?.tier as DatasetTier) ?? DatasetTier.TIER_100K,
      version: fromPayload?.version ?? 'v1',
    };
  }

  private async markUnavailable(jobId: string, reason: string): Promise<void> {
    await this.updateJobPayload(jobId, {
      metricsStatus: 'unavailable',
      metrics: [],
      metricsHint: reason,
    });
  }

  private async updateJobPayload(
    jobId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const job = await this.jobStore.getById(jobId);
    if (!job) {
      return;
    }

    await this.jobStore.update({
      ...job,
      payloadSummary: {
        ...job.payloadSummary,
        ...fields,
      },
    });
  }
}
