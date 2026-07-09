import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlaygroundDatabaseModule } from '../../database/playground/playground-database.module';
import { RedisModule } from '../../common/services/redis.module';
import { ExperimentIsolationModule } from '../experiment-isolation/experiment-isolation.module';
import { WorkerQueueModule } from '../worker-queue/worker-queue.module';
import { DatasetLoaderController } from './dataset-loader.controller';
import { PrepareDatasetUseCase } from './application/prepare-dataset.usecase';
import { GetDatasetMetadataUseCase } from './application/get-dataset-metadata.usecase';
import { ResetDatasetUseCase } from './application/reset-dataset.usecase';
import { ExecuteDatasetResetService } from './application/execute-dataset-reset.service';
import { DatasetManifestRepository } from './infrastructure/dataset-manifest.repository';
import { DatasetSeedRunner } from './infrastructure/dataset-seed.runner';
import { DatasetPlaygroundTeardown } from './infrastructure/dataset-playground-teardown';
import { DatasetPreparationStatusStore } from './infrastructure/dataset-preparation-status.store';

@Module({
  imports: [
    ConfigModule,
    PlaygroundDatabaseModule,
    RedisModule,
    ExperimentIsolationModule,
    WorkerQueueModule,
  ],
  controllers: [DatasetLoaderController],
  providers: [
    DatasetManifestRepository,
    DatasetSeedRunner,
    DatasetPlaygroundTeardown,
    DatasetPreparationStatusStore,
    PrepareDatasetUseCase,
    GetDatasetMetadataUseCase,
    ResetDatasetUseCase,
    ExecuteDatasetResetService,
  ],
  exports: [
    PrepareDatasetUseCase,
    GetDatasetMetadataUseCase,
    ResetDatasetUseCase,
    ExecuteDatasetResetService,
    DatasetSeedRunner,
    DatasetManifestRepository,
  ],
})
export class DatasetLoaderModule {}
