export type MetricSource = 'execution' | 'explain' | 'combined' | 'benchmark';

export interface MetricCatalogEntry {
  key: string;
  label: string;
  unit: string;
  group: string;
  source: MetricSource;
}

export const DATABASE_METRICS_CATALOG: MetricCatalogEntry[] = [
  {
    key: 'execution_time_ms',
    label: 'Execution Time',
    unit: 'ms',
    group: 'performance',
    source: 'combined',
  },
  {
    key: 'rows_returned',
    label: 'Rows Returned',
    unit: 'rows',
    group: 'scan',
    source: 'execution',
  },
  {
    key: 'rows_scanned',
    label: 'Rows Scanned',
    unit: 'rows',
    group: 'scan',
    source: 'explain',
  },
  {
    key: 'index_scan_used',
    label: 'Index Scan Used',
    unit: 'count',
    group: 'scan',
    source: 'explain',
  },
  {
    key: 'seq_scan_used',
    label: 'Sequential Scan Used',
    unit: 'count',
    group: 'scan',
    source: 'explain',
  },
  {
    key: 'planning_time_ms',
    label: 'Planning Time',
    unit: 'ms',
    group: 'plan',
    source: 'explain',
  },
  {
    key: 'plan_total_cost',
    label: 'Plan Total Cost',
    unit: 'cost',
    group: 'plan',
    source: 'explain',
  },
  {
    key: 'plan_execution_time_ms',
    label: 'Plan Execution Time',
    unit: 'ms',
    group: 'plan',
    source: 'explain',
  },
  {
    key: 'latency_avg_ms',
    label: 'Average Latency',
    unit: 'ms',
    group: 'latency',
    source: 'benchmark',
  },
  {
    key: 'latency_p95_ms',
    label: 'P95 Latency',
    unit: 'ms',
    group: 'latency',
    source: 'benchmark',
  },
  {
    key: 'latency_p99_ms',
    label: 'P99 Latency',
    unit: 'ms',
    group: 'latency',
    source: 'benchmark',
  },
  {
    key: 'achieved_rps',
    label: 'Achieved RPS',
    unit: 'rps',
    group: 'throughput',
    source: 'benchmark',
  },
  {
    key: 'throughput_rps',
    label: 'Throughput',
    unit: 'rps',
    group: 'throughput',
    source: 'benchmark',
  },
  {
    key: 'error_rate_pct',
    label: 'Error Rate',
    unit: '%',
    group: 'reliability',
    source: 'benchmark',
  },
];

const CATALOGS: Record<string, MetricCatalogEntry[]> = {
  'database-metrics': DATABASE_METRICS_CATALOG,
};

export function resolveMetricCatalog(catalogId?: string): MetricCatalogEntry[] {
  const id = catalogId ?? 'database-metrics';
  return CATALOGS[id] ?? DATABASE_METRICS_CATALOG;
}

export function findCatalogEntry(
  catalog: MetricCatalogEntry[],
  key: string,
): MetricCatalogEntry | undefined {
  return catalog.find((entry) => entry.key === key);
}

export function resolveBenchmarkCatalog(
  catalogId?: string,
): MetricCatalogEntry[] {
  return resolveMetricCatalog(catalogId).filter(
    (entry) => entry.source === 'benchmark',
  );
}
