import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExperimentIsolationModule } from '../experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../metrics-pipeline/metrics-pipeline.module';
import { SqlSandboxModule } from '../sql-sandbox/sql-sandbox.module';
import { WorkerQueueModule } from '../worker-queue/worker-queue.module';
import { BenchmarkRunnerController } from './benchmark-runner.controller';
import { EnqueueBenchmarkUseCase } from './application/enqueue-benchmark.usecase';
import { GetBenchmarkStatusUseCase } from './application/get-benchmark-status.usecase';
import { ObserveBenchmarkProgressUseCase } from './application/observe-benchmark-progress.usecase';
import { BenchmarkProfileValidator } from './infrastructure/benchmark-profile.validator';
import { BenchmarkProgressStore } from './infrastructure/benchmark-progress.store';
import { K6ProgressMapper } from './infrastructure/k6-progress.mapper';

@Module({
  imports: [
    ConfigModule,
    WorkerQueueModule,
    ExperimentIsolationModule,
    SqlSandboxModule,
    MetricsPipelineModule,
  ],
  controllers: [BenchmarkRunnerController],
  providers: [
    BenchmarkProfileValidator,
    BenchmarkProgressStore,
    K6ProgressMapper,
    EnqueueBenchmarkUseCase,
    GetBenchmarkStatusUseCase,
    ObserveBenchmarkProgressUseCase,
  ],
  exports: [
    EnqueueBenchmarkUseCase,
    GetBenchmarkStatusUseCase,
    ObserveBenchmarkProgressUseCase,
    BenchmarkProgressStore,
    K6ProgressMapper,
  ],
})
export class BenchmarkRunnerModule {}
