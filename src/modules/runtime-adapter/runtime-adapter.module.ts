import { Module } from '@nestjs/common';
import { ExperimentRunnerModule } from '../experiment-runner/experiment-runner.module';
import { RuntimeAdapterRegistry } from './application/runtime-adapter.registry';
import { RunExperimentUseCase } from './application/run-experiment.usecase';
import { PostgresqlRuntimeAdapter } from './infrastructure/postgresql-runtime.adapter';
import { ReactRuntimeAdapter } from './infrastructure/react-runtime.adapter';

/**
 * Registers all Runtime Adapters and the track-agnostic experiment
 * orchestrator. To add a Track (Redis, Kafka, Docker, …): implement a new
 * RuntimeAdapter, add it to providers and the registry factory `inject` list.
 */
@Module({
  imports: [ExperimentRunnerModule],
  providers: [
    PostgresqlRuntimeAdapter,
    ReactRuntimeAdapter,
    RunExperimentUseCase,
    {
      provide: RuntimeAdapterRegistry,
      useFactory: (
        postgresql: PostgresqlRuntimeAdapter,
        react: ReactRuntimeAdapter,
      ) => new RuntimeAdapterRegistry([postgresql, react]),
      inject: [PostgresqlRuntimeAdapter, ReactRuntimeAdapter],
    },
  ],
  exports: [RuntimeAdapterRegistry, RunExperimentUseCase],
})
export class RuntimeAdapterModule {}
