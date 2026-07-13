import { Injectable } from '@nestjs/common';
import {
  RuntimeAdapterType,
  RuntimeExperimentContext,
  RuntimeExperimentResult,
} from '@db-play/types';
import { RuntimeAdapterRegistry } from './runtime-adapter.registry';

export interface RunExperimentCommand<TInput = unknown> {
  adapterType: RuntimeAdapterType;
  input: TInput;
  context?: RuntimeExperimentContext;
}

/**
 * Track-agnostic experiment orchestrator: resolves the adapter for the Track's
 * runtime and runs it. This is the single entry point callers use instead of
 * branching on Track type.
 */
@Injectable()
export class RunExperimentUseCase {
  constructor(private readonly registry: RuntimeAdapterRegistry) {}

  async execute<TInput = unknown>(
    command: RunExperimentCommand<TInput>,
  ): Promise<RuntimeExperimentResult> {
    const adapter = this.registry.resolve(command.adapterType);
    return adapter.run(command.input, command.context ?? {});
  }
}
