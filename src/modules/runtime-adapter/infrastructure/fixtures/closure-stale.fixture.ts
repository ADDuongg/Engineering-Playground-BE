import React, { useEffect, useRef, useState } from 'react';
import type TestRenderer from 'react-test-renderer';
import { ReactFixture, ReactFixtureContext } from '../../domain/react-fixture';
import { getActiveObservation } from '../../domain/react-observation';

function StaleClosureDemo(): React.ReactElement {
  const [count, setCount] = useState(0);
  const obs = getActiveObservation();
  const captured = useRef(0);

  useEffect(() => {
    obs.mounts += 1;
    obs.hostMutations += 1;
    obs.effectRunCount += 1;
    // Capture initial count into ref once (stale teaching signal)
    captured.current = 0;
    obs.capturedValue = 0;
    return () => {
      obs.unmounts += 1;
      obs.hostMutations += 1;
    };
  }, [obs]);

  return React.createElement(
    'div',
    {
      'data-testid': 'stale',
      'data-count': String(count),
      onClick: () => {
        setCount((c) => c + 1);
        // Reading captured ref after clicks demonstrates stale capture
        if (captured.current !== count + 1) {
          obs.staleReads += 1;
        }
      },
      onTick: () => {
        // synthetic tick interaction
        if (captured.current === 0) {
          obs.staleReads += 0;
        }
      },
    },
    `count:${count}`,
  );
}

export const closureStaleIntervalFixture: ReactFixture = {
  id: 'closure/stale-interval',
  supportedActions: ['inspect_hooks', 'render_component', 'update_state'],
  defaultProps: {},
  measurementSet: [
    'effect_run_count',
    'captured_value',
    'stale_reads',
    'render_count',
    'commit_duration_ms',
  ],
  createRoot(_ctx: ReactFixtureContext) {
    return React.createElement(StaleClosureDemo);
  },
};

export function applyClosureInteraction(
  renderer: TestRenderer.ReactTestRenderer,
  interaction: unknown,
): boolean {
  const type =
    interaction && typeof interaction === 'object' && 'type' in interaction
      ? String((interaction as { type: unknown }).type).toLowerCase()
      : '';
  try {
    if (type === 'click' || type === 'setstate') {
      const node = renderer.root.findByProps({ 'data-testid': 'stale' });
      node.props.onClick?.();
      return true;
    }
    if (type === 'tick') {
      const node = renderer.root.findByProps({ 'data-testid': 'stale' });
      node.props.onTick?.();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
