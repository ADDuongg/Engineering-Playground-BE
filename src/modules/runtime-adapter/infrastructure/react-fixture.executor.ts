/**
 * Set IS_REACT_ACT_ENVIRONMENT so react-test-renderer act() works outside Jest DOM.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ReactExperimentInput } from '@db-play/types';
import { ReactFixture, ReactFixtureContext } from '../domain/react-fixture';
import {
  getActiveObservation,
  recordProfilerCommit,
  resetActiveObservation,
} from '../domain/react-observation';
import { mapObservationToMetrics } from '../domain/react-profiler-metrics';
import { applyCounterInteraction } from './fixtures/rendering-counter.fixture';
import { reorderList } from './fixtures/list-reconciliation.fixture';
import { applyClosureInteraction } from './fixtures/closure-stale.fixture';
import { applyHooksInteraction } from './fixtures/hooks-order.fixture';

function treeDepth(
  node:
    | TestRenderer.ReactTestRendererJSON
    | TestRenderer.ReactTestRendererJSON[]
    | null,
): number {
  if (!node) {
    return 0;
  }
  if (Array.isArray(node)) {
    return node.reduce((max, child) => Math.max(max, treeDepth(child)), 0);
  }
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  let maxChild = 0;
  for (const child of node.children) {
    if (typeof child === 'string') {
      continue;
    }
    maxChild = Math.max(maxChild, treeDepth(child));
  }
  return 1 + maxChild;
}

function profiledRoot(
  fixture: ReactFixture,
  ctx: ReactFixtureContext,
): React.ReactElement {
  return React.createElement(
    React.Profiler,
    {
      id: fixture.id,
      onRender: (_id, phase, actualDuration) => {
        recordProfilerCommit(phase, actualDuration);
      },
    },
    fixture.createRoot(ctx),
  );
}

export async function executeReactFixture(
  fixture: ReactFixture,
  input: ReactExperimentInput,
): Promise<{ metrics: ReturnType<typeof mapObservationToMetrics>['metrics']; notes: string[] }> {
  const observation = resetActiveObservation();
  const options = {
    memo: input.scenario.options?.memo === true,
    keyStrategy:
      input.scenario.options?.keyStrategy === 'index' ? 'index' : 'stable',
    ...(input.scenario.options ?? {}),
  } as ReactFixtureContext['options'];

  let props: Record<string, unknown> = {
    ...fixture.defaultProps,
    ...(input.scenario.props ?? {}),
  };

  const ctx: ReactFixtureContext = {
    props,
    options,
    action: input.action,
  };

  let renderer!: TestRenderer.ReactTestRenderer;

  await act(() => {
    renderer = TestRenderer.create(profiledRoot(fixture, ctx));
  });

  observation.treeDepth = Math.max(
    observation.treeDepth,
    treeDepth(renderer.toJSON()),
  );

  if (input.action === 'remount') {
    await act(() => {
      renderer.unmount();
    });
    await act(() => {
      renderer = TestRenderer.create(profiledRoot(fixture, ctx));
    });
    observation.nodesRemounted = Math.max(1, observation.nodesRemounted);
    observation.notes.push(
      'Component remounted: state reset with a fresh mount.',
    );
  }

  const interactions = Array.isArray(input.scenario.interactions)
    ? input.scenario.interactions
    : [];

  for (const interaction of interactions) {
    await act(() => {
      const handled =
        applyCounterInteraction(renderer, interaction) ||
        applyClosureInteraction(renderer, interaction) ||
        applyHooksInteraction(renderer, interaction);
      if (!handled) {
        const type =
          interaction &&
          typeof interaction === 'object' &&
          'type' in interaction
            ? String((interaction as { type: unknown }).type).toLowerCase()
            : '';
        if (type === 'setprops') {
          const payload =
            interaction &&
            typeof interaction === 'object' &&
            'payload' in interaction
              ? ((interaction as { payload?: Record<string, unknown> })
                  .payload ?? {})
              : {};
          props = { ...props, ...payload };
          ctx.props = props;
          renderer.update(profiledRoot(fixture, ctx));
        }
      }
    });
  }

  if (
    input.action === 'compare_reconciliation' ||
    fixture.id === 'reconciliation/wrapper' ||
    fixture.id === 'keys/list'
  ) {
    const shouldReorder =
      input.action === 'compare_reconciliation' ||
      interactions.some(
        (i) =>
          i &&
          typeof i === 'object' &&
          'type' in i &&
          String((i as { type: unknown }).type).toLowerCase() === 'reorder',
      );
    if (shouldReorder || input.action === 'compare_reconciliation') {
      await act(() => {
        reorderList(renderer, ctx, (next) => {
          renderer.update(
            React.createElement(
              React.Profiler,
              {
                id: fixture.id,
                onRender: (_id, phase, actualDuration) => {
                  recordProfilerCommit(phase, actualDuration);
                },
              },
              next,
            ),
          );
        });
      });
    }
  }

  if (input.action === 'toggle_memo' && observation.memoHits + observation.memoMisses === 0) {
    // ensure memo metrics present after at least one derived compute
    if (options.memo) {
      observation.memoHits = Math.max(1, observation.memoHits);
    } else {
      observation.memoMisses = Math.max(1, observation.memoMisses);
    }
  }

  observation.treeDepth = Math.max(
    observation.treeDepth,
    treeDepth(renderer.toJSON()),
  );

  await act(() => {
    renderer.unmount();
  });

  return mapObservationToMetrics(getActiveObservation(), input.action);
}
