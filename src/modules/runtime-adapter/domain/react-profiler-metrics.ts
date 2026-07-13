import { MetricContract } from '@db-play/types';
import { reactMetric } from '../../metrics-pipeline/domain/react-metrics.catalog';
import { ProfilerObservation } from './react-observation';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function push(
  values: Array<[string, number]>,
  key: string,
  value: number | null | undefined,
): void {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return;
  }
  values.push([key, value]);
}

/**
 * Map headless profiler observations to Metric Contract entries.
 * Omits inapplicable keys rather than zero-filling.
 */
export function mapObservationToMetrics(
  observation: ProfilerObservation,
  action: string,
): { metrics: MetricContract[]; notes: string[] } {
  const values: Array<[string, number]> = [];
  const notes = [...observation.notes];

  const commitDuration =
    observation.commitDurationsMs.length > 0
      ? round2(
          observation.commitDurationsMs.reduce((a, b) => a + b, 0),
        )
      : null;

  const reconciliationActions = new Set([
    'compare_reconciliation',
    'render_component',
  ]);
  const renderActions = new Set([
    'render_component',
    'update_state',
    'update_props',
    'remount',
    'toggle_memo',
  ]);
  const hookActions = new Set(['inspect_hooks', 'toggle_memo']);

  if (renderActions.has(action) || observation.renderCount > 0) {
    push(values, 'render_count', observation.renderCount);
    push(values, 'commit_duration_ms', commitDuration);
    push(
      values,
      'component_tree_depth',
      observation.treeDepth > 0 ? observation.treeDepth : 2,
    );
  }

  if (action === 'remount' || observation.nodesRemounted > 0) {
    push(
      values,
      'remount_count',
      observation.nodesRemounted > 0
        ? observation.nodesRemounted
        : observation.unmounts > 0
          ? 1
          : undefined,
    );
  }

  if (
    reconciliationActions.has(action) ||
    observation.nodesReused > 0 ||
    observation.nodesRemounted > 0 ||
    observation.hostMutations > 0
  ) {
    if (
      action === 'compare_reconciliation' ||
      observation.nodesReused > 0 ||
      observation.nodesRemounted > 0
    ) {
      push(values, 'nodes_reused', observation.nodesReused);
      push(values, 'nodes_remounted', observation.nodesRemounted);
      push(
        values,
        'dom_mutations',
        observation.hostMutations > 0
          ? observation.hostMutations
          : observation.mounts + observation.unmounts,
      );
      if (observation.nodesRemounted > 0) {
        push(values, 'remount_count', observation.nodesRemounted);
      }
    }
  }

  if (hookActions.has(action) || action === 'toggle_memo') {
    const totalMemo = observation.memoHits + observation.memoMisses;
    if (totalMemo > 0 || action === 'toggle_memo') {
      const rate =
        totalMemo > 0
          ? round2((observation.memoHits / totalMemo) * 100)
          : observation.memoHits > 0
            ? 100
            : 0;
      push(values, 'memo_hit_rate', rate);
    }
  }

  if (action === 'inspect_hooks') {
    push(values, 'effect_run_count', observation.effectRunCount);
    if (observation.capturedValue !== null) {
      push(values, 'captured_value', observation.capturedValue);
    }
    push(values, 'stale_reads', observation.staleReads);
  }

  // Always include timing when we observed commits but action omitted render set
  if (commitDuration !== null && !values.some(([k]) => k === 'commit_duration_ms')) {
    push(values, 'commit_duration_ms', commitDuration);
  }
  if (
    observation.renderCount > 0 &&
    !values.some(([k]) => k === 'render_count')
  ) {
    push(values, 'render_count', observation.renderCount);
  }

  const metrics = values
    .map(([key, value]) => reactMetric(key, value))
    .filter((metric): metric is MetricContract => metric !== null);

  if (notes.length === 0 && observation.renderCount > 0) {
    notes.push(
      `${observation.renderCount} commit(s) observed in the headless sandbox.`,
    );
  }

  return { metrics, notes };
}
