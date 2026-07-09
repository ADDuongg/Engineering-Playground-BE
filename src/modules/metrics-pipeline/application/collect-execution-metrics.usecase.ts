import { Injectable } from '@nestjs/common';
import {
  CollectMetricsResult,
  ExperimentRunResult,
  MetricContract,
  MetricRunContext,
} from '@db-play/types';
import {
  findCatalogEntry,
  resolveMetricCatalog,
} from '../domain/database-metrics.catalog';

@Injectable()
export class CollectExecutionMetricsUseCase {
  execute(
    result: ExperimentRunResult,
    context: MetricRunContext,
  ): CollectMetricsResult {
    const catalog = resolveMetricCatalog(context.metricCatalogId);
    const metrics: MetricContract[] = [];
    const omittedMetricKeys: string[] = [];

    this.addMetric(
      catalog,
      metrics,
      omittedMetricKeys,
      'execution_time_ms',
      result.executionTimeMs,
    );
    this.addMetric(
      catalog,
      metrics,
      omittedMetricKeys,
      'rows_returned',
      result.rowCount,
    );

    for (const entry of catalog) {
      if (
        entry.source === 'explain' &&
        !metrics.some((metric) => metric.key === entry.key)
      ) {
        omittedMetricKeys.push(entry.key);
      }
    }

    return {
      metrics,
      omittedMetricKeys:
        omittedMetricKeys.length > 0 ? omittedMetricKeys : undefined,
    };
  }

  private addMetric(
    catalog: ReturnType<typeof resolveMetricCatalog>,
    metrics: MetricContract[],
    omittedMetricKeys: string[],
    key: string,
    value: number | undefined,
  ): void {
    const entry = findCatalogEntry(catalog, key);

    if (!entry || entry.source === 'explain') {
      return;
    }

    if (value === undefined || Number.isNaN(value)) {
      omittedMetricKeys.push(key);
      return;
    }

    metrics.push({
      key: entry.key,
      label: entry.label,
      unit: entry.unit,
      value,
      group: entry.group,
    });
  }
}
