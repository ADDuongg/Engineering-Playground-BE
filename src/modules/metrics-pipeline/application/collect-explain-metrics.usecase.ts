import { Injectable } from '@nestjs/common';
import {
  CollectMetricsResult,
  ExplainMode,
  ExplainRunResult,
  MetricContract,
  MetricRunContext,
} from '@db-play/types';
import {
  findCatalogEntry,
  resolveMetricCatalog,
} from '../domain/database-metrics.catalog';
import { summarizePlanScans } from '../domain/plan-scan.util';

@Injectable()
export class CollectExplainMetricsUseCase {
  execute(
    result: ExplainRunResult,
    context: MetricRunContext,
  ): CollectMetricsResult {
    const catalog = resolveMetricCatalog(context.metricCatalogId);
    const metrics: MetricContract[] = [];
    const omittedMetricKeys: string[] = [];
    const scanSummary = summarizePlanScans(result.plan);

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
      'rows_scanned',
      scanSummary.rowsScanned,
    );
    this.addMetric(
      catalog,
      metrics,
      omittedMetricKeys,
      'index_scan_used',
      scanSummary.indexScanUsed ? 1 : 0,
    );
    this.addMetric(
      catalog,
      metrics,
      omittedMetricKeys,
      'seq_scan_used',
      scanSummary.seqScanUsed ? 1 : 0,
    );
    this.addMetric(
      catalog,
      metrics,
      omittedMetricKeys,
      'plan_total_cost',
      result.plan.totalCost,
    );

    if (result.explainMode === ExplainMode.EXPLAIN_ANALYZE) {
      this.addMetric(
        catalog,
        metrics,
        omittedMetricKeys,
        'planning_time_ms',
        result.planningTimeMs,
      );
      this.addMetric(
        catalog,
        metrics,
        omittedMetricKeys,
        'plan_execution_time_ms',
        result.executionTimeMs,
      );
    } else {
      omittedMetricKeys.push('planning_time_ms', 'plan_execution_time_ms');
    }

    for (const entry of catalog) {
      if (
        entry.source === 'execution' &&
        !metrics.some((metric) => metric.key === entry.key)
      ) {
        omittedMetricKeys.push(entry.key);
      }
    }

    const uniqueOmitted = [...new Set(omittedMetricKeys)];

    return {
      metrics,
      omittedMetricKeys:
        uniqueOmitted.length > 0 ? uniqueOmitted : undefined,
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

    if (!entry) {
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
