import { Injectable } from '@nestjs/common';
import {
  CollectMetricsResult,
  ExperimentRunResult,
  ExplainRunResult,
  MetricContract,
  MetricRunContext,
} from '@db-play/types';
import { CollectExecutionMetricsUseCase } from './collect-execution-metrics.usecase';
import { CollectExplainMetricsUseCase } from './collect-explain-metrics.usecase';
import { PersistMetricSnapshotUseCase } from './persist-metric-snapshot.usecase';

@Injectable()
export class MetricsEnrichmentService {
  constructor(
    private readonly collectExecutionMetrics: CollectExecutionMetricsUseCase,
    private readonly collectExplainMetrics: CollectExplainMetricsUseCase,
    private readonly persistMetricSnapshot: PersistMetricSnapshotUseCase,
  ) {}

  async enrichExecutionResult(
    result: ExperimentRunResult,
    context: Omit<MetricRunContext, 'runType' | 'dataset'>,
  ): Promise<ExperimentRunResult> {
    const runContext: MetricRunContext = {
      ...context,
      runType: 'execution',
      dataset: result.dataset,
    };

    const collected = this.collectExecutionMetrics.execute(result, runContext);
    return this.attachMetrics(result, collected, runContext);
  }

  async enrichExplainResult(
    result: ExplainRunResult,
    context: Omit<MetricRunContext, 'runType' | 'dataset'>,
  ): Promise<ExplainRunResult> {
    const runContext: MetricRunContext = {
      ...context,
      runType: 'explain',
      dataset: result.dataset,
    };

    const collected = this.collectExplainMetrics.execute(result, runContext);
    return this.attachMetrics(result, collected, runContext);
  }

  private async attachMetrics<T extends { metrics?: MetricContract[] }>(
    result: T,
    collected: CollectMetricsResult,
    context: MetricRunContext,
  ): Promise<T & { runId: string; omittedMetricKeys?: string[] }> {
    const persisted = await this.persistMetricSnapshot.execute({
      context,
      metrics: collected.metrics,
      omittedMetricKeys: collected.omittedMetricKeys,
    });

    return {
      ...result,
      metrics: collected.metrics,
      runId: persisted.runId,
      omittedMetricKeys: collected.omittedMetricKeys,
    };
  }
}
