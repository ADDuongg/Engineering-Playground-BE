import React, { useEffect, useMemo, useState } from 'react';
import type TestRenderer from 'react-test-renderer';
import { ReactFixture, ReactFixtureContext } from '../../domain/react-fixture';
import { getActiveObservation } from '../../domain/react-observation';

function CounterInner(props: {
  initial?: number;
  memoEnabled?: boolean;
}): React.ReactElement {
  const [count, setCount] = useState(props.initial ?? 0);
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

  const memoLabel = useMemo(() => {
    if (props.memoEnabled) {
      obs.memoHits += 1;
    }
    return `count:${count}`;
  }, [count, props.memoEnabled, obs]);

  const label = props.memoEnabled
    ? memoLabel
    : (() => {
        obs.memoMisses += 1;
        return `count:${count}`;
      })();

  return React.createElement(
    'div',
    {
      'data-testid': 'counter',
      'data-count': String(count),
      onClick: () => setCount((c) => c + 1),
    },
    label,
  );
}

export const renderingCounterFixture: ReactFixture = {
  id: 'rendering/counter',
  supportedActions: [
    'render_component',
    'update_state',
    'update_props',
    'remount',
    'toggle_memo',
  ],
  defaultProps: { initial: 0 },
  measurementSet: [
    'render_count',
    'commit_duration_ms',
    'component_tree_depth',
    'memo_hit_rate',
  ],
  createRoot(ctx: ReactFixtureContext) {
    return React.createElement(CounterInner, {
      initial: Number(ctx.props.initial ?? 0),
      memoEnabled: ctx.options.memo === true,
    });
  },
};

export function applyCounterInteraction(
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
    const node = renderer.root.findByProps({ 'data-testid': 'counter' });
    node.props.onClick?.();
    return true;
  } catch {
    return false;
  }
}
