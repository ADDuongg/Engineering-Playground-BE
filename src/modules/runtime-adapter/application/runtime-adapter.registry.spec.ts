import { ErrorCode, RuntimeAdapterType } from '@db-play/types';
import { RuntimeAdapter } from '../domain/runtime-adapter';
import { RuntimeAdapterRegistry } from './runtime-adapter.registry';

function fakeAdapter(type: RuntimeAdapterType): RuntimeAdapter {
  return {
    type,
    run: jest.fn().mockResolvedValue({ adapterType: type, metrics: [] }),
  };
}

describe('RuntimeAdapterRegistry', () => {
  it('resolves a registered adapter by type', () => {
    const pg = fakeAdapter(RuntimeAdapterType.PLAYGROUND_POSTGRESQL);
    const react = fakeAdapter(RuntimeAdapterType.HEADLESS_REACT_SANDBOX);
    const registry = new RuntimeAdapterRegistry([pg, react]);

    expect(registry.resolve(RuntimeAdapterType.HEADLESS_REACT_SANDBOX)).toBe(
      react,
    );
    expect(registry.has(RuntimeAdapterType.PLAYGROUND_POSTGRESQL)).toBe(true);
    expect(registry.list()).toEqual([
      RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
      RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
    ]);
  });

  it('throws NOT_FOUND for an unregistered type', () => {
    const registry = new RuntimeAdapterRegistry([
      fakeAdapter(RuntimeAdapterType.PLAYGROUND_POSTGRESQL),
    ]);

    let thrown: unknown;
    try {
      registry.resolve(RuntimeAdapterType.PLAYGROUND_REDIS);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(registry.has(RuntimeAdapterType.PLAYGROUND_REDIS)).toBe(false);
  });

  it('rejects duplicate adapter registrations', () => {
    expect(
      () =>
        new RuntimeAdapterRegistry([
          fakeAdapter(RuntimeAdapterType.PLAYGROUND_POSTGRESQL),
          fakeAdapter(RuntimeAdapterType.PLAYGROUND_POSTGRESQL),
        ]),
    ).toThrow(/Duplicate runtime adapter/);
  });
});
