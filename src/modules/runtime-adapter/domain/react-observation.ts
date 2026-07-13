/**
 * Per-run mutable observation bucket filled by Profiler + fixture instrumentation.
 * Reset before every sandbox execution.
 */
export interface ProfilerObservation {
  renderCount: number;
  commitDurationsMs: number[];
  treeDepth: number;
  nodesReused: number;
  nodesRemounted: number;
  hostMutations: number;
  mounts: number;
  unmounts: number;
  memoHits: number;
  memoMisses: number;
  effectRunCount: number;
  capturedValue: number | null;
  staleReads: number;
  notes: string[];
}

export function createEmptyObservation(): ProfilerObservation {
  return {
    renderCount: 0,
    commitDurationsMs: [],
    treeDepth: 0,
    nodesReused: 0,
    nodesRemounted: 0,
    hostMutations: 0,
    mounts: 0,
    unmounts: 0,
    memoHits: 0,
    memoMisses: 0,
    effectRunCount: 0,
    capturedValue: null,
    staleReads: 0,
    notes: [],
  };
}

/** Module-scoped active observation for the current run (fixtures write here). */
let active: ProfilerObservation = createEmptyObservation();

export function resetActiveObservation(): ProfilerObservation {
  active = createEmptyObservation();
  return active;
}

export function getActiveObservation(): ProfilerObservation {
  return active;
}

export function recordProfilerCommit(
  phase: 'mount' | 'update' | string,
  actualDuration: number,
): void {
  active.renderCount += 1;
  active.commitDurationsMs.push(Math.max(0, actualDuration));
  if (phase === 'mount') {
    active.hostMutations += 1;
  }
}
