import { Module } from '@nestjs/common';
import { DatasetLoaderModule } from '../dataset-loader/dataset-loader.module';
import { SqlSandboxModule } from '../sql-sandbox/sql-sandbox.module';
import { ExperimentIsolationModule } from '../experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../metrics-pipeline/metrics-pipeline.module';
import { WorkerQueueModule } from '../worker-queue/worker-queue.module';
import { ExperimentRunnerController } from './experiment-runner.controller';
import { RunExperimentSqlUseCase } from './application/run-experiment-sql.usecase';
import { EnqueueSqlRunUseCase } from './application/enqueue-sql-run.usecase';

@Module({
  imports: [
    SqlSandboxModule,
    DatasetLoaderModule,
    ExperimentIsolationModule,
    MetricsPipelineModule,
    WorkerQueueModule,
  ],
  controllers: [ExperimentRunnerController],
  providers: [RunExperimentSqlUseCase, EnqueueSqlRunUseCase],
  exports: [RunExperimentSqlUseCase, EnqueueSqlRunUseCase],
})
export class ExperimentRunnerModule {}
