import { Module } from '@nestjs/common';
import { ExperimentRunnerModule } from '../experiment-runner/experiment-runner.module';
import { LabsModule } from '../labs/labs.module';
import { ProgressModule } from '../progress/progress.module';
import { RuntimeAdapterRegistry } from './application/runtime-adapter.registry';
import { RunExperimentUseCase } from './application/run-experiment.usecase';
import { RunReactExperimentUseCase } from './application/run-react-experiment.usecase';
import { LabReactFixtureAllowlistService } from './application/lab-react-fixture-allowlist.service';
import { ReactSandboxConfig } from './config/react-sandbox.config';
import { PostgresqlRuntimeAdapter } from './infrastructure/postgresql-runtime.adapter';
import { ReactRuntimeAdapter } from './infrastructure/react-runtime.adapter';
import { ReactFixtureRegistry } from './infrastructure/react-fixture.registry';
import { ReactExperimentController } from './react-experiment.controller';

/**
 * Registers all Runtime Adapters and the track-agnostic experiment
 * orchestrator. To add a Track (Redis, Kafka, Docker, …): implement a new
 * RuntimeAdapter, add it to providers and the registry factory `inject` list.
 */
@Module({
  imports: [ExperimentRunnerModule, LabsModule, ProgressModule],
  controllers: [ReactExperimentController],
  providers: [
    ReactSandboxConfig,
    ReactFixtureRegistry,
    LabReactFixtureAllowlistService,
    PostgresqlRuntimeAdapter,
    ReactRuntimeAdapter,
    RunExperimentUseCase,
    RunReactExperimentUseCase,
    {
      provide: RuntimeAdapterRegistry,
      useFactory: (
        postgresql: PostgresqlRuntimeAdapter,
        react: ReactRuntimeAdapter,
      ) => new RuntimeAdapterRegistry([postgresql, react]),
      inject: [PostgresqlRuntimeAdapter, ReactRuntimeAdapter],
    },
  ],
  exports: [
    RuntimeAdapterRegistry,
    RunExperimentUseCase,
    RunReactExperimentUseCase,
    ReactFixtureRegistry,
  ],
})
export class RuntimeAdapterModule {}
