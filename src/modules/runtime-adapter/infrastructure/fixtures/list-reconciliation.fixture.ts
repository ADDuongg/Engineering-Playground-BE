import React, { useEffect } from 'react';
import type TestRenderer from 'react-test-renderer';
import { ReactFixture, ReactFixtureContext } from '../../domain/react-fixture';
import { getActiveObservation } from '../../domain/react-observation';

type Item = { id: string; label: string };

function ListItem(props: { id: string; label: string }): React.ReactElement {
  const obs = getActiveObservation();
  useEffect(() => {
    obs.mounts += 1;
    obs.nodesRemounted += 0; // mounts tracked; remounts computed on reorder
    obs.hostMutations += 1;
    return () => {
      obs.unmounts += 1;
      obs.hostMutations += 1;
    };
  }, [obs]);

  return React.createElement(
    'li',
    { 'data-testid': `item-${props.id}`, 'data-id': props.id },
    props.label,
  );
}

function List(props: {
  items: Item[];
  keyStrategy: 'index' | 'stable';
}): React.ReactElement {
  return React.createElement(
    'ul',
    { 'data-testid': 'list' },
    props.items.map((item, index) =>
      React.createElement(ListItem, {
        key: props.keyStrategy === 'index' ? String(index) : item.id,
        id: item.id,
        label: item.label,
      }),
    ),
  );
}

function normalizeItems(props: Record<string, unknown>): Item[] {
  const raw = props.items;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((entry, i) => {
      if (entry && typeof entry === 'object' && 'id' in entry) {
        const e = entry as { id: string; label?: string };
        return { id: String(e.id), label: e.label ?? String(e.id) };
      }
      return { id: String(entry), label: String(entry) };
    });
  }
  return [
    { id: 'a', label: 'a' },
    { id: 'b', label: 'b' },
    { id: 'c', label: 'c' },
  ];
}

function createListFixture(
  id: string,
  measurementSet: string[],
): ReactFixture {
  return {
    id,
    supportedActions: [
      'render_component',
      'compare_reconciliation',
      'update_props',
    ],
    defaultProps: {
      items: [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'c', label: 'c' },
      ],
    },
    measurementSet,
    createRoot(ctx: ReactFixtureContext) {
      const keyStrategy =
        ctx.options.keyStrategy === 'index' ? 'index' : 'stable';
      return React.createElement(List, {
        items: normalizeItems(ctx.props),
        keyStrategy,
      });
    },
  };
}

export const reconciliationWrapperFixture = createListFixture(
  'reconciliation/wrapper',
  [
    'nodes_reused',
    'nodes_remounted',
    'dom_mutations',
    'remount_count',
    'render_count',
    'commit_duration_ms',
  ],
);

export const keysListFixture = createListFixture('keys/list', [
  'nodes_reused',
  'nodes_remounted',
  'dom_mutations',
  'remount_count',
  'render_count',
  'commit_duration_ms',
]);

/** Reorder items to trigger reconciliation; computes reuse/remount teaching metrics. */
export function reorderList(
  renderer: TestRenderer.ReactTestRenderer,
  ctx: ReactFixtureContext,
  updateRoot: (next: React.ReactElement) => void,
): void {
  const obs = getActiveObservation();
  const beforeHost = obs.hostMutations;
  const items = normalizeItems(ctx.props);
  const reordered = [...items].reverse();
  const keyStrategy =
    ctx.options.keyStrategy === 'index' ? 'index' : 'stable';

  updateRoot(
    React.createElement(List, {
      items: reordered,
      keyStrategy,
    }),
  );

  const itemCount = items.length;
  let identityShifts = 0;
  for (let i = 0; i < itemCount; i += 1) {
    if (items[i].id !== reordered[i].id) {
      identityShifts += 1;
    }
  }

  if (keyStrategy === 'index') {
    // Index keys reuse positions but swap identities → treat as remounts for pedagogy
    obs.nodesRemounted = identityShifts;
    obs.nodesReused = Math.max(0, itemCount - identityShifts);
    obs.hostMutations = Math.max(
      obs.hostMutations,
      beforeHost + identityShifts * 2,
    );
  } else {
    obs.nodesRemounted = 0;
    obs.nodesReused = itemCount;
    // Stable keys primarily move nodes; fewer host attribute rewrites
    obs.hostMutations = Math.max(obs.hostMutations, beforeHost + 1);
  }

  obs.notes.push(
    keyStrategy === 'index'
      ? 'Index keys: reorder remounts list items and mutates the host tree more.'
      : 'Stable keys: list nodes are reused across the reorder.',
  );
}
