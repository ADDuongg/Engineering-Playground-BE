import { mapObservationToMetrics } from './react-profiler-metrics';
import { createEmptyObservation } from './react-observation';

describe('mapObservationToMetrics', () => {
  it('maps render observations with non-negative commit duration', () => {
    const obs = createEmptyObservation();
    obs.renderCount = 3;
    obs.commitDurationsMs = [0.4, 0.5, 0.6];
    obs.treeDepth = 2;

    const { metrics } = mapObservationToMetrics(obs, 'update_state');
    expect(metrics.find((m) => m.key === 'render_count')?.value).toBe(3);
    expect(
      metrics.find((m) => m.key === 'commit_duration_ms')?.value,
    ).toBeGreaterThanOrEqual(0);
  });

  it('includes reconciliation metrics for compare_reconciliation', () => {
    const obs = createEmptyObservation();
    obs.renderCount = 2;
    obs.commitDurationsMs = [1];
    obs.nodesReused = 2;
    obs.nodesRemounted = 1;
    obs.hostMutations = 4;

    const { metrics } = mapObservationToMetrics(obs, 'compare_reconciliation');
    expect(metrics.find((m) => m.key === 'nodes_reused')?.value).toBe(2);
    expect(metrics.find((m) => m.key === 'dom_mutations')?.value).toBe(4);
  });
});
