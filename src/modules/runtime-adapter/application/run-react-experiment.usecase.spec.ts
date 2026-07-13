import { ErrorCode, RuntimeAdapterType } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { ReactSandboxConfig } from '../config/react-sandbox.config';
import { ReactFixtureRegistry } from '../infrastructure/react-fixture.registry';
import { LabReactFixtureAllowlistService } from './lab-react-fixture-allowlist.service';
import { RunExperimentUseCase } from './run-experiment.usecase';
import { RunReactExperimentUseCase } from './run-react-experiment.usecase';

describe('RunReactExperimentUseCase', () => {
  const allowlist = {
    assertAllowed: jest.fn(),
  };
  const runExperiment = {
    execute: jest.fn(),
  };
  const sandboxConfig = {
    getPolicy: () => ({
      timeoutMs: 5000,
      maxInteractions: 50,
      maxItems: 500,
      policyVersion: 'react-sandbox-v1',
    }),
  };

  const useCase = new RunReactExperimentUseCase(
    allowlist as unknown as LabReactFixtureAllowlistService,
    new ReactFixtureRegistry(),
    sandboxConfig as unknown as ReactSandboxConfig,
    runExperiment as unknown as RunExperimentUseCase,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    allowlist.assertAllowed.mockResolvedValue(undefined);
    runExperiment.execute.mockResolvedValue({
      adapterType: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
      metrics: [],
      raw: { action: 'render_component', scenarioId: 'rendering/counter', interactionCount: 0, notes: [] },
    });
  });

  it('dispatches headless React adapter after allowlist', async () => {
    await useCase.execute({
      action: 'render_component',
      fixtureId: 'rendering/counter',
      labSlug: 'react-rendering',
      userId: 'u1',
    });

    expect(allowlist.assertAllowed).toHaveBeenCalledWith(
      'react-rendering',
      'rendering/counter',
    );
    expect(runExperiment.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterType: RuntimeAdapterType.HEADLESS_REACT_SANDBOX,
        input: expect.objectContaining({
          action: 'render_component',
          scenario: expect.objectContaining({
            scenarioId: 'rendering/counter',
          }),
        }),
      }),
    );
  });

  it('rejects componentSource before execution', async () => {
    await expect(
      useCase.execute({
        action: 'render_component',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
        componentSource: 'function App(){return null}',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(runExperiment.execute).not.toHaveBeenCalled();
  });

  it('rejects over-cap interactions', async () => {
    await expect(
      useCase.execute({
        action: 'update_state',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
        interactions: Array.from({ length: 51 }, () => ({ type: 'click' })),
      }),
    ).rejects.toMatchObject({ code: ErrorCode.SANDBOX_ERROR });
  });

  it('maps timeout to DomainError TIMEOUT', async () => {
    const slow = new RunReactExperimentUseCase(
      allowlist as unknown as LabReactFixtureAllowlistService,
      new ReactFixtureRegistry(),
      {
        getPolicy: () => ({
          timeoutMs: 10,
          maxInteractions: 50,
          maxItems: 500,
          policyVersion: 'react-sandbox-v1',
        }),
      } as unknown as ReactSandboxConfig,
      {
        execute: () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100);
          }),
      } as unknown as RunExperimentUseCase,
    );

    await expect(
      slow.execute({
        action: 'render_component',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      slow.execute({
        action: 'render_component',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.TIMEOUT });
  });
});
