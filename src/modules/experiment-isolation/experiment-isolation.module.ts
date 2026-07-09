import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaygroundDatabaseModule } from '../../database/playground/playground-database.module';
import { RedisModule } from '../../common/services/redis.module';
import { TracksModule } from '../tracks/tracks.module';
import { WorkerQueueModule } from '../worker-queue/worker-queue.module';
import { ExperimentIsolationController } from './experiment-isolation.controller';
import { ProvisionExperimentSessionUseCase } from './application/provision-experiment-session.usecase';
import { GetExperimentSessionUseCase } from './application/get-experiment-session.usecase';
import { TeardownExperimentSessionUseCase } from './application/teardown-experiment-session.usecase';
import { ExperimentSessionStore } from './infrastructure/experiment-session.store';
import { PlaygroundSchemaProvisioner } from './infrastructure/playground-schema.provisioner';

@Module({
  imports: [
    ConfigModule,
    PlaygroundDatabaseModule,
    RedisModule,
    TracksModule,
    WorkerQueueModule,
  ],
  controllers: [ExperimentIsolationController],
  providers: [
    ExperimentSessionStore,
    PlaygroundSchemaProvisioner,
    ProvisionExperimentSessionUseCase,
    GetExperimentSessionUseCase,
    TeardownExperimentSessionUseCase,
  ],
  exports: [
    GetExperimentSessionUseCase,
    ProvisionExperimentSessionUseCase,
    TeardownExperimentSessionUseCase,
  ],
})
export class ExperimentIsolationModule {}
