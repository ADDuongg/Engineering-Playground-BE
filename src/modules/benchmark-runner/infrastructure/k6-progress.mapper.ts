import { Injectable } from '@nestjs/common';
import { PartialMetric } from '@db-play/types';
import {
  findCatalogEntry,
  resolveBenchmarkCatalog,
} from '../../metrics-pipeline/domain/database-metrics.catalog';

export interface K6ProgressMappingResult {
  currentRps: number | null;
  partialMetrics: PartialMetric[];
}

/**
 * Maps interim k6 aggregate samples to provisional progress metrics.
 * Only includes measured fields — never invents zeros.
 */
@Injectable()
export class K6ProgressMapper {
  map(
    sample: Record<string, unknown>,
    catalogId?: string,
  ): K6ProgressMappingResult {
    const catalog = resolveBenchmarkCatalog(catalogId);
    const values = this.extractValues(sample);
    const partialMetrics: PartialMetric[] = [];

    const candidates: Array<{ key: string; value: number | undefined }> = [
      { key: 'achieved_rps', value: values.achievedRps },
      { key: 'latency_avg_ms', value: values.latencyAvgMs },
      { key: 'error_rate_pct', value: values.errorRatePct },
    ];

    for (const item of candidates) {
      if (item.value === undefined || !Number.isFinite(item.value)) {
        continue;
      }
      const entry = findCatalogEntry(catalog, item.key);
      if (!entry) {
        continue;
      }
      partialMetrics.push({
        key: entry.key,
        label: entry.label,
        unit: entry.unit,
        value: item.value,
        group: entry.group,
        provisional: true,
      });
    }

    return {
      currentRps:
        values.achievedRps !== undefined && Number.isFinite(values.achievedRps)
          ? values.achievedRps
          : null,
      partialMetrics,
    };
  }

  private extractValues(sample: Record<string, unknown>): {
    latencyAvgMs?: number;
    achievedRps?: number;
    errorRatePct?: number;
  } {
    const metricsRoot =
      (sample.metrics as Record<string, unknown> | undefined) ?? sample;

    const duration = this.readMetricValues(metricsRoot, 'http_req_duration');
    const httpReqs = this.readMetricValues(metricsRoot, 'http_reqs');
    const httpFailed = this.readMetricValues(metricsRoot, 'http_req_failed');

    const achievedRps =
      this.asNumber(httpReqs.rate) ??
      this.deriveRateFromCount(httpReqs, sample);

    const failedRate =
      this.asNumber(httpFailed.value) ?? this.asNumber(httpFailed.rate);

    return {
      latencyAvgMs: this.asNumber(duration.avg),
      achievedRps,
      errorRatePct:
        failedRate === undefined ? undefined : failedRate * 100,
    };
  }

  private deriveRateFromCount(
    httpReqs: Record<string, number | undefined>,
    sample: Record<string, unknown>,
  ): number | undefined {
    const count = this.asNumber(httpReqs.count) ?? this.asNumber(httpReqs.value);
    const elapsedMs =
      this.asNumber(sample.elapsedMs) ?? this.asNumber(sample.elapsed);
    if (count === undefined || elapsedMs === undefined || elapsedMs <= 0) {
      return undefined;
    }
    return (count / elapsedMs) * 1000;
  }

  private readMetricValues(
    metricsRoot: Record<string, unknown>,
    name: string,
  ): Record<string, number | undefined> {
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
      return record.values as Record<string, number | undefined>;
    }
    return record as Record<string, number | undefined>;
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
