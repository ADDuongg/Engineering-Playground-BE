import { Injectable } from '@nestjs/common';
import {
  ReactExperimentInput,
  ReactExperimentRaw,
  RuntimeAdapterType,
  RuntimeExperimentContext,
  RuntimeExperimentResult,
} from '@db-play/types';
import { RuntimeAdapter } from '../domain/runtime-adapter';
import { deriveReactMetrics } from '../domain/react-metrics.model';

/**
 * Frontend React runtime (headless React sandbox). Executes a guided-step
 * scenario and emits React Metric Contract metrics. Metric computation is
 * modeled deterministically for now (see {@link deriveReactMetrics}); the
 * adapter boundary lets a real headless profiler drop in later unchanged.
 */
@Injectable()
export class ReactRuntimeAdapter
  implements RuntimeAdapter<ReactExperimentInput, ReactExperimentRaw>
{
  readonly type = RuntimeAdapterType.HEADLESS_REACT_SANDBOX;

  async run(
    input: ReactExperimentInput,
    _context: RuntimeExperimentContext,
  ): Promise<RuntimeExperimentResult<ReactExperimentRaw>> {
    const { metrics, notes } = deriveReactMetrics(input);
    const interactionCount = Array.isArray(input.scenario.interactions)
      ? input.scenario.interactions.length
      : 0;

    return {
      adapterType: this.type,
      metrics,
      raw: {
        action: input.action,
        scenarioId: input.scenario.scenarioId,
        interactionCount,
        notes,
      },
    };
  }
}
