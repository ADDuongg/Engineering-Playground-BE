import { RuntimeAdapterType } from '@db-play/types';
import { RuntimeAdapter } from '../domain/runtime-adapter';
import { RuntimeAdapterRegistry } from './runtime-adapter.registry';
import { RunExperimentUseCase } from './run-experiment.usecase';

describe('RunExperimentUseCase', () => {
  it('dispatches to the adapter resolved from the registry', async () => {
    const run = jest.fn().mockResolvedValue({
      adapterType: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
      metrics: [{ key: 'render_count', label: 'x', unit: 'count', group: 'render', value: 1 }],
    });
    const adapter: RuntimeAdapter = {
      type: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
      run,
    };
    const useCase = new RunExperimentUseCase(
      new RuntimeAdapterRegistry([adapter]),
    );

    const input = { action: 'render_component', scenario: {} };
    const result = await useCase.execute({
      adapterType: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
      input,
      context: { requestId: 'req-1' },
    });

    expect(run).toHaveBeenCalledWith(input, { requestId: 'req-1' });
    expect(result.metrics).toHaveLength(1);
  });

  it('defaults context to an empty object when omitted', async () => {
    const run = jest
      .fn()
      .mockResolvedValue({ adapterType: RuntimeAdapterType.PLAYGROUND_POSTGRESQL, metrics: [] });
    const useCase = new RunExperimentUseCase(
      new RuntimeAdapterRegistry([
        { type: RuntimeAdapterType.PLAYGROUND_POSTGRESQL, run },
      ]),
    );

    await useCase.execute({
      adapterType: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
      input: { sql: 'SELECT 1' },
    });

    expect(run).toHaveBeenCalledWith({ sql: 'SELECT 1' }, {});
  });
});
