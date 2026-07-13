import { Injectable } from '@nestjs/common';
import {
  ReactExperimentInput,
  ReactExperimentRaw,
  RuntimeAdapterType,
  RuntimeExperimentContext,
  RuntimeExperimentResult,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { ErrorCode } from '@db-play/types';
import { RuntimeAdapter } from '../domain/runtime-adapter';
import { ReactFixtureRegistry } from './react-fixture.registry';
import { executeReactFixture } from './react-fixture.executor';

/**
 * Frontend React runtime (headless React sandbox). Executes built-in fixtures
 * via react-test-renderer + Profiler and emits react-metrics Metric Contract.
 */
@Injectable()
export class ReactRuntimeAdapter
  implements RuntimeAdapter<ReactExperimentInput, ReactExperimentRaw>
{
  readonly type = RuntimeAdapterType.HEADLESS_REACT_SANDBOX;

  constructor(private readonly fixtures: ReactFixtureRegistry) {}

  async run(
    input: ReactExperimentInput,
    _context: RuntimeExperimentContext,
  ): Promise<RuntimeExperimentResult<ReactExperimentRaw>> {
    const fixtureId =
      input.scenario.fixtureId ?? input.scenario.scenarioId ?? '';
    if (!fixtureId) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'A fixtureId (scenarioId) is required for React experiments.',
        400,
      );
    }

    if (
      typeof input.scenario.componentSource === 'string' &&
      input.scenario.componentSource.trim().length > 0
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Executable componentSource is not supported in MVP. Use a built-in fixtureId.',
        400,
        { reason: 'COMPONENT_SOURCE_FORBIDDEN' },
      );
    }

    const fixture = this.fixtures.get(fixtureId);
    if (!fixture) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Unknown React fixture "${fixtureId}".`,
        404,
        { fixtureId },
      );
    }

    if (
      fixture.supportedActions.length > 0 &&
      !fixture.supportedActions.includes(input.action)
    ) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Action "${input.action}" is not supported for fixture "${fixtureId}".`,
        400,
        {
          reason: 'UNSUPPORTED_ACTION',
          allowedActions: fixture.supportedActions,
        },
      );
    }

    try {
      const { metrics, notes } = await executeReactFixture(fixture, input);
      const interactionCount = Array.isArray(input.scenario.interactions)
        ? input.scenario.interactions.length
        : 0;

      return {
        adapterType: this.type,
        metrics,
        raw: {
          action: input.action,
          scenarioId: fixtureId,
          interactionCount,
          notes,
        },
      };
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'React sandbox execution failed';
      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        `The React scenario failed during execution: ${message}`,
        422,
        { reason: 'REACT_RUNTIME_FAULT' },
      );
    }
  }
}
