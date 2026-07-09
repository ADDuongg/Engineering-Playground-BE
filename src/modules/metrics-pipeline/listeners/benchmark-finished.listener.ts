import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BENCHMARK_FINISHED_EVENT,
  BenchmarkFinishedEvent,
} from '@db-play/types';
import { CollectBenchmarkMetricsUseCase } from '../application/collect-benchmark-metrics.usecase';

@Injectable()
export class BenchmarkFinishedListener {
  constructor(
    private readonly collectBenchmarkMetrics: CollectBenchmarkMetricsUseCase,
  ) {}

  @OnEvent(BENCHMARK_FINISHED_EVENT)
  async handle(event: BenchmarkFinishedEvent): Promise<void> {
    await this.collectBenchmarkMetrics.execute(event);
  }
}
