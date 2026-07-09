import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerQueueModule } from '../worker-queue/worker-queue.module';
import { CollectBenchmarkMetricsUseCase } from './application/collect-benchmark-metrics.usecase';
import { CollectExecutionMetricsUseCase } from './application/collect-execution-metrics.usecase';
import { CollectExplainMetricsUseCase } from './application/collect-explain-metrics.usecase';
import { GetBenchmarkMetricHistoryUseCase } from './application/get-benchmark-metric-history.usecase';
import { GetBenchmarkMetricsUseCase } from './application/get-benchmark-metrics.usecase';
import { GetMetricHistoryUseCase } from './application/get-metric-history.usecase';
import { MetricsEnrichmentService } from './application/metrics-enrichment.service';
import { PersistMetricSnapshotUseCase } from './application/persist-metric-snapshot.usecase';
import { MetricsPipelineController } from './metrics-pipeline.controller';
import { MetricSnapshotEntity } from './infrastructure/metric-snapshot.entity';
import { MetricSnapshotRepository } from './infrastructure/metric-snapshot.repository';
import { K6SummaryParser } from './infrastructure/k6-summary.parser';
import { BenchmarkFinishedListener } from './listeners/benchmark-finished.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([MetricSnapshotEntity], 'platform'),
    WorkerQueueModule,
  ],
  controllers: [MetricsPipelineController],
  providers: [
    CollectExecutionMetricsUseCase,
    CollectExplainMetricsUseCase,
    CollectBenchmarkMetricsUseCase,
    PersistMetricSnapshotUseCase,
    GetMetricHistoryUseCase,
    GetBenchmarkMetricsUseCase,
    GetBenchmarkMetricHistoryUseCase,
    MetricsEnrichmentService,
    MetricSnapshotRepository,
    K6SummaryParser,
    BenchmarkFinishedListener,
  ],
  exports: [
    CollectExecutionMetricsUseCase,
    CollectExplainMetricsUseCase,
    CollectBenchmarkMetricsUseCase,
    PersistMetricSnapshotUseCase,
    GetBenchmarkMetricsUseCase,
    GetBenchmarkMetricHistoryUseCase,
    MetricsEnrichmentService,
  ],
})
export class MetricsPipelineModule {}
