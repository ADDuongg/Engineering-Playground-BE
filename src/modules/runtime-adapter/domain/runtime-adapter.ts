import {
  RuntimeAdapterType,
  RuntimeExperimentContext,
  RuntimeExperimentResult,
} from '@db-play/types';

/**
 * A Runtime Adapter executes experiments for one Track's runtime
 * (PostgreSQL, headless React sandbox, Redis, Kafka, …) and returns a uniform
 * result. Adapters are infrastructure: application code depends on this
 * interface, never on a concrete runtime (ARCHITECTURE §20).
 *
 * Adding a new Track only adds a new adapter — the experiment lifecycle
 * (input → adapter → metrics) never changes.
 */
export interface RuntimeAdapter<TInput = unknown, TRaw = unknown> {
  /** The runtime this adapter serves; used by the registry for resolution. */
  readonly type: RuntimeAdapterType;

  run(
    input: TInput,
    context: RuntimeExperimentContext,
  ): Promise<RuntimeExperimentResult<TRaw>>;
}
