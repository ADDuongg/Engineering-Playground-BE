import { Module } from '@nestjs/common';
import { DatasetLoaderModule } from '../dataset-loader/dataset-loader.module';
import { ExperimentIsolationModule } from '../experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../metrics-pipeline/metrics-pipeline.module';
import { SqlSandboxModule } from '../sql-sandbox/sql-sandbox.module';
import { RunExplainUseCase } from './application/run-explain.usecase';
import { ExplainRunnerController } from './explain-runner.controller';

@Module({
  imports: [
    SqlSandboxModule,
    DatasetLoaderModule,
    ExperimentIsolationModule,
    MetricsPipelineModule,
  ],
  controllers: [ExplainRunnerController],
  providers: [RunExplainUseCase],
  exports: [RunExplainUseCase],
})
export class ExplainRunnerModule {}
