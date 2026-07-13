/**
 * @deprecated Deterministic placeholder teaching model. Production uses
 * react-test-renderer + Profiler via `executeReactFixture`. Kept for reference
 * only — do not wire into ReactRuntimeAdapter.
 */
import { MetricContract, ReactExperimentInput } from '@db-play/types';
import { reactMetric } from '../../metrics-pipeline/domain/react-metrics.catalog';

const RERENDER_TYPES = new Set(['click', 'setprops', 'setstate']);

function interactionType(interaction: unknown): string {
  if (interaction && typeof interaction === 'object' && 'type' in interaction) {
    return String((interaction as { type: unknown }).type).toLowerCase();
  }
  return '';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function itemCount(input: ReactExperimentInput): number {
  const items = (input.scenario.props as { items?: unknown[] } | undefined)
    ?.items;
  return Array.isArray(items) ? items.length : 3;
}

export function deriveReactMetrics(input: ReactExperimentInput): {
  metrics: MetricContract[];
  notes: string[];
} {
  const { action, scenario } = input;
  const interactions = Array.isArray(scenario.interactions)
    ? scenario.interactions
    : [];
  const rerenders = interactions.filter((i) =>
    RERENDER_TYPES.has(interactionType(i)),
  ).length;
  const clicks = interactions.filter((i) => interactionType(i) === 'click')
    .length;
  const memo = scenario.options?.memo === true;
  const indexKeys = scenario.options?.keyStrategy === 'index';

  const values: Array<[string, number]> = [];
  const notes: string[] = [];

  switch (action) {
    case 'render_component':
    case 'update_state':
    case 'update_props': {
      const renderCount = 1 + rerenders;
      values.push(['render_count', renderCount]);
      values.push(['commit_duration_ms', round2(renderCount * 0.8)]);
      values.push(['component_tree_depth', 2]);
      notes.push(`${renderCount} render(s): 1 mount + ${rerenders} update(s).`);
      break;
    }
    case 'remount': {
      const renderCount = 2 + rerenders;
      values.push(['render_count', renderCount]);
      values.push(['remount_count', 1]);
      values.push(['commit_duration_ms', round2(renderCount * 0.8)]);
      notes.push('Component remounted: state reset with a fresh mount.');
      break;
    }
    case 'compare_reconciliation': {
      const items = itemCount(input);
      const moved = indexKeys ? items : 0;
      values.push(['nodes_reused', items - moved]);
      values.push(['nodes_remounted', moved]);
      values.push(['dom_mutations', indexKeys ? items * 2 : moved]);
      values.push(['remount_count', moved]);
      notes.push(
        indexKeys
          ? 'Index keys: reorder remounts items and mutates the DOM more.'
          : 'Stable keys: nodes are reused across the reorder.',
      );
      break;
    }
    case 'toggle_memo': {
      values.push(['memo_hit_rate', memo ? 100 : 0]);
      values.push(['render_count', 1 + rerenders]);
      notes.push(
        memo
          ? 'Memoized: derived value cached across renders.'
          : 'No memo: derived value recomputes each render.',
      );
      break;
    }
    case 'inspect_hooks': {
      values.push(['effect_run_count', 1]);
      values.push(['memo_hit_rate', memo ? 100 : 0]);
      values.push(['captured_value', 0]);
      values.push(['stale_reads', clicks]);
      notes.push(
        `Stale closure captured value 0 while state advanced by ${clicks} click(s).`,
      );
      break;
    }
    default: {
      notes.push(`No React metrics modeled for action "${action}".`);
      break;
    }
  }

  const metrics = values
    .map(([key, value]) => reactMetric(key, value))
    .filter((metric): metric is MetricContract => metric !== null);

  return { metrics, notes };
}
