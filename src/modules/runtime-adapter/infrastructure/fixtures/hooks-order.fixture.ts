import React, { useEffect, useMemo, useState } from 'react';
import type TestRenderer from 'react-test-renderer';
import { ReactFixture, ReactFixtureContext } from '../../domain/react-fixture';
import { getActiveObservation } from '../../domain/react-observation';

function HooksOrderDemo(props: { memoEnabled?: boolean }): React.ReactElement {
  const [n, setN] = useState(0);
  const obs = getActiveObservation();

  useEffect(() => {
    obs.mounts += 1;
    obs.hostMutations += 1;
    obs.effectRunCount += 1;
    return () => {
      obs.unmounts += 1;
      obs.hostMutations += 1;
    };
  }, [obs]);

  useEffect(() => {
    obs.effectRunCount += 1;
  }, [n, obs]);

  const memoDerived = useMemo(() => {
    if (props.memoEnabled) {
      obs.memoHits += 1;
    }
    return n * 2;
  }, [n, props.memoEnabled, obs]);

  const derived = props.memoEnabled
    ? memoDerived
    : (() => {
        obs.memoMisses += 1;
        return n * 2;
      })();

  return React.createElement(
    'div',
    {
      'data-testid': 'hooks',
      'data-n': String(n),
      'data-derived': String(derived),
      onClick: () => setN((v) => v + 1),
    },
    `n:${n},derived:${derived}`,
  );
}

export const hooksOrderFixture: ReactFixture = {
  id: 'hooks/order',
  supportedActions: [
    'inspect_hooks',
    'toggle_memo',
    'render_component',
    'update_state',
  ],
  defaultProps: {},
  measurementSet: [
    'effect_run_count',
    'memo_hit_rate',
    'render_count',
    'commit_duration_ms',
  ],
  createRoot(ctx: ReactFixtureContext) {
    return React.createElement(HooksOrderDemo, {
      memoEnabled: ctx.options.memo === true,
    });
  },
};

export function applyHooksInteraction(
  renderer: TestRenderer.ReactTestRenderer,
  interaction: unknown,
): boolean {
  const type =
    interaction && typeof interaction === 'object' && 'type' in interaction
      ? String((interaction as { type: unknown }).type).toLowerCase()
      : '';
  if (type !== 'click' && type !== 'setstate') {
    return false;
  }
  try {
    const node = renderer.root.findByProps({ 'data-testid': 'hooks' });
    node.props.onClick?.();
    return true;
  } catch {
    return false;
  }
}
