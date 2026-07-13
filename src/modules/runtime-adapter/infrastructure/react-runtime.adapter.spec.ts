import { RuntimeAdapterType } from '@db-play/types';
import { ReactFixtureRegistry } from './react-fixture.registry';
import { ReactRuntimeAdapter } from './react-runtime.adapter';

describe('ReactRuntimeAdapter', () => {
  const registry = new ReactFixtureRegistry();
  const adapter = new ReactRuntimeAdapter(registry);

  it('has the headless React runtime type', () => {
    expect(adapter.type).toBe(RuntimeAdapterType.HEADLESS_REACT_SANDBOX);
  });

  it('counts renders from state interactions (update_state)', async () => {
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
    expect(render?.value).toBeGreaterThanOrEqual(3); // mount + 2 updates
    expect(result.raw?.interactionCount).toBe(2);
    const duration = result.metrics.find((m) => m.key === 'commit_duration_ms');
    expect(duration?.value).toBeGreaterThanOrEqual(0);
  });

  it('models reconciliation differently for index vs stable keys', async () => {
    const indexKeys = await adapter.run(
      {
        action: 'compare_reconciliation',
        scenario: {
          scenarioId: 'reconciliation/wrapper',
          options: { keyStrategy: 'index' },
          props: {
            items: [
              { id: 'a', label: 'a' },
              { id: 'b', label: 'b' },
              { id: 'c', label: 'c' },
            ],
          },
        },
      },
      {},
    );
    const stableKeys = await adapter.run(
      {
        action: 'compare_reconciliation',
        scenario: {
          scenarioId: 'reconciliation/wrapper',
          options: { keyStrategy: 'stable' },
          props: {
            items: [
              { id: 'a', label: 'a' },
              { id: 'b', label: 'b' },
              { id: 'c', label: 'c' },
            ],
          },
        },
      },
      {},
    );

    const remounts = (r: typeof indexKeys) =>
      r.metrics.find((m) => m.key === 'nodes_remounted')?.value ?? 0;
    expect(remounts(indexKeys)).toBeGreaterThan(remounts(stableKeys));
    expect(
      indexKeys.metrics.find((m) => m.key === 'dom_mutations')?.value,
    ).toBeGreaterThan(0);
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

    expect(
      result.metrics.find((m) => m.key === 'stale_reads')?.value,
    ).toBeGreaterThanOrEqual(2);
    expect(result.metrics.find((m) => m.key === 'captured_value')?.value).toBe(
      0,
    );
  });

  it('emits normalized metric metadata from the catalog', async () => {
    const result = await adapter.run(
      {
        action: 'render_component',
        scenario: { scenarioId: 'rendering/counter' },
      },
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

  it('rejects unknown fixtures', async () => {
    await expect(
      adapter.run(
        { action: 'render_component', scenario: { scenarioId: 'nope/x' } },
        {},
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects componentSource', async () => {
    await expect(
      adapter.run(
        {
          action: 'render_component',
          scenario: {
            scenarioId: 'rendering/counter',
            componentSource: 'function App(){return null}',
          },
        },
        {},
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
