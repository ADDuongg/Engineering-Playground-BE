import { Injectable } from '@nestjs/common';
import { MetricContract } from '@db-play/types';
import {
  findCatalogEntry,
  resolveBenchmarkCatalog,
} from '../domain/database-metrics.catalog';

type MetricValues = Record<string, number | undefined>;

@Injectable()
export class K6SummaryParser {
  parse(
    summary: Record<string, unknown>,
    catalogId?: string,
  ): { metrics: MetricContract[]; omittedMetricKeys: string[] } {
    const catalog = resolveBenchmarkCatalog(catalogId);
    const values = this.extractValues(summary);
    const metrics: MetricContract[] = [];
    const omittedMetricKeys: string[] = [];

    const required: Array<{ key: string; value: number | undefined }> = [
      { key: 'latency_avg_ms', value: values.latencyAvgMs },
      { key: 'latency_p95_ms', value: values.latencyP95Ms },
      { key: 'latency_p99_ms', value: values.latencyP99Ms },
      { key: 'achieved_rps', value: values.achievedRps },
      { key: 'throughput_rps', value: values.throughputRps },
      { key: 'error_rate_pct', value: values.errorRatePct },
    ];

    for (const item of required) {
      const entry = findCatalogEntry(catalog, item.key);
      if (!entry) {
        omittedMetricKeys.push(item.key);
        continue;
      }

      if (item.value === undefined || !Number.isFinite(item.value)) {
        omittedMetricKeys.push(item.key);
        continue;
      }

      metrics.push({
        key: entry.key,
        label: entry.label,
        unit: entry.unit,
        value: item.value,
        group: entry.group,
      });
    }

    if (metrics.length < 6) {
      throw new Error(
        `Incomplete k6 summary: missing ${omittedMetricKeys.join(', ')}`,
      );
    }

    return { metrics, omittedMetricKeys };
  }

  private extractValues(summary: Record<string, unknown>): {
    latencyAvgMs?: number;
    latencyP95Ms?: number;
    latencyP99Ms?: number;
    achievedRps?: number;
    throughputRps?: number;
    errorRatePct?: number;
  } {
    const metricsRoot =
      (summary.metrics as Record<string, unknown> | undefined) ?? summary;

    const duration = this.readMetricValues(metricsRoot, 'http_req_duration');
    const httpReqs = this.readMetricValues(metricsRoot, 'http_reqs');
    const httpFailed = this.readMetricValues(metricsRoot, 'http_req_failed');

    const achievedRps = this.asNumber(httpReqs.rate);
    // k6 Rate metrics export `value` (0–1); Counter metrics export `rate`.
    const failedRate =
      this.asNumber(httpFailed.value) ?? this.asNumber(httpFailed.rate) ?? 0;
    const throughputRps =
      achievedRps === undefined
        ? undefined
        : achievedRps * (1 - Math.min(Math.max(failedRate, 0), 1));

    return {
      latencyAvgMs: this.asNumber(duration.avg),
      latencyP95Ms: this.asNumber(
        duration['p(95)'] ?? duration.p95 ?? duration['p95'],
      ),
      latencyP99Ms: this.asNumber(
        duration['p(99)'] ??
          duration.p99 ??
          duration['p99'] ??
          // Fallback when summaryTrendStats omitted p(99): use p(95) as lower bound.
          duration['p(95)'] ??
          duration.p95,
      ),
      achievedRps,
      throughputRps,
      errorRatePct: failedRate * 100,
    };
  }

  private readMetricValues(
    metricsRoot: Record<string, unknown>,
    name: string,
  ): MetricValues {
    const metric = metricsRoot[name];
    if (!metric || typeof metric !== 'object') {
      return {};
    }

    const record = metric as Record<string, unknown>;
    if (
      record.values &&
      typeof record.values === 'object' &&
      !Array.isArray(record.values)
    ) {
      return record.values as MetricValues;
    }

    return record as MetricValues;
  }

  private asNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}
