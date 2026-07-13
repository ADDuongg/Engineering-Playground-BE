import { MetricContract } from '@db-play/types';
import type { MetricCatalogEntry } from './database-metrics.catalog';

/**
 * Metric Catalog for the Frontend React track (headless React sandbox runtime).
 * Metrics originate from the Backend runtime adapter — never computed in the FE.
 */
export const REACT_METRICS_CATALOG: MetricCatalogEntry[] = [
  {
    key: 'render_count',
    label: 'Render Count',
    unit: 'count',
    group: 'render',
    source: 'execution',
  },
  {
    key: 'commit_duration_ms',
    label: 'Commit Duration',
    unit: 'ms',
    group: 'render',
    source: 'execution',
  },
  {
    key: 'component_tree_depth',
    label: 'Component Tree Depth',
    unit: 'count',
    group: 'render',
    source: 'execution',
  },
  {
    key: 'nodes_reused',
    label: 'Nodes Reused',
    unit: 'count',
    group: 'reconciliation',
    source: 'execution',
  },
  {
    key: 'nodes_remounted',
    label: 'Nodes Remounted',
    unit: 'count',
    group: 'reconciliation',
    source: 'execution',
  },
  {
    key: 'dom_mutations',
    label: 'DOM Mutations',
    unit: 'count',
    group: 'reconciliation',
    source: 'execution',
  },
  {
    key: 'remount_count',
    label: 'Remount Count',
    unit: 'count',
    group: 'reconciliation',
    source: 'execution',
  },
  {
    key: 'memo_hit_rate',
    label: 'Memo Hit Rate',
    unit: '%',
    group: 'memoization',
    source: 'execution',
  },
  {
    key: 'effect_run_count',
    label: 'Effect Run Count',
    unit: 'count',
    group: 'hooks',
    source: 'execution',
  },
  {
    key: 'captured_value',
    label: 'Captured Value',
    unit: 'count',
    group: 'hooks',
    source: 'execution',
  },
  {
    key: 'stale_reads',
    label: 'Stale Reads',
    unit: 'count',
    group: 'hooks',
    source: 'execution',
  },
];

/**
 * Build a normalized Metric Contract entry for a React metric key, pulling
 * label/unit/group from the catalog so metadata has a single source of truth.
 */
export function reactMetric(key: string, value: number): MetricContract | null {
  const entry = REACT_METRICS_CATALOG.find((m) => m.key === key);
  if (!entry) {
    return null;
  }
  return {
    key: entry.key,
    label: entry.label,
    unit: entry.unit,
    group: entry.group,
    value,
  };
}
