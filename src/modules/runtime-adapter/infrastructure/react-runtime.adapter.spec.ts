import { RuntimeAdapterType } from '@db-play/types';
import { ReactRuntimeAdapter } from './react-runtime.adapter';

describe('ReactRuntimeAdapter', () => {
  const adapter = new ReactRuntimeAdapter();

  it('has the headless React runtime type', () => {
    expect(adapter.type).toBe(RuntimeAdapterType.HEADLESS_REACT_SANDBOX);
  });

  it('counts renders from state interactions (render_component)', async () => {
    const result = await adapter.run(
      {
        action: 'update_state',
        scenario: {
          scenarioId: 'rendering/counter',
          interactions: [{ type: 'click' }, { type: 'click' }],
        },
      },
      {},
    );

    expect(result.adapterType).toBe(RuntimeAdapterType.HEADLESS_REACT_SANDBOX);
    const render = result.metrics.find((m) => m.key === 'render_count');
    expect(render?.value).toBe(3); // 1 mount + 2 updates
    expect(result.raw?.interactionCount).toBe(2);
  });

  it('models reconciliation differently for index vs stable keys', async () => {
    const indexKeys = await adapter.run(
      {
        action: 'compare_reconciliation',
        scenario: {
          options: { keyStrategy: 'index' },
          props: { items: ['a', 'b', 'c'] },
        },
      },
      {},
    );
    const stableKeys = await adapter.run(
      {
        action: 'compare_reconciliation',
        scenario: {
          options: { keyStrategy: 'stable' },
          props: { items: ['a', 'b', 'c'] },
        },
      },
      {},
    );

    const remounts = (r: typeof indexKeys) =>
      r.metrics.find((m) => m.key === 'nodes_remounted')?.value;
    expect(remounts(indexKeys)).toBe(3);
    expect(remounts(stableKeys)).toBe(0);
  });

  it('models stale closure reads from clicks (inspect_hooks)', async () => {
    const result = await adapter.run(
      {
        action: 'inspect_hooks',
        scenario: {
          scenarioId: 'closure/stale-interval',
          interactions: [{ type: 'click' }, { type: 'click' }, { type: 'tick' }],
        },
      },
      {},
    );

    expect(result.metrics.find((m) => m.key === 'stale_reads')?.value).toBe(2);
    expect(result.metrics.find((m) => m.key === 'captured_value')?.value).toBe(
      0,
    );
  });

  it('emits normalized metric metadata from the catalog', async () => {
    const result = await adapter.run(
      { action: 'render_component', scenario: {} },
      {},
    );
    const render = result.metrics.find((m) => m.key === 'render_count');
    expect(render).toMatchObject({
      key: 'render_count',
      label: 'Render Count',
      unit: 'count',
      group: 'render',
    });
  });
});
