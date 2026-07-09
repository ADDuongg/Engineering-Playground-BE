import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { join } from 'path';
import configuration from '../config/configuration';
import { envValidationSchema } from '../config/env.validation';
import { RedisModule } from '../common/services/redis.module';
import { PlatformDatabaseModule } from '../database/platform/platform-database.module';
import { ExperimentIsolationModule } from '../modules/experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from '../modules/metrics-pipeline/metrics-pipeline.module';
import { K6BenchmarkExecutor } from '../modules/benchmark-runner/infrastructure/k6-benchmark.executor';
import { K6ProgressMapper } from '../modules/benchmark-runner/infrastructure/k6-progress.mapper';
import { BenchmarkProgressStore } from '../modules/benchmark-runner/infrastructure/benchmark-progress.store';
import { WorkerQueueModule } from '../modules/worker-queue/worker-queue.module';
import { BenchmarkWorkerProcessor } from './benchmark-worker.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '.env'),
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    EventEmitterModule.forRoot(),
    RedisModule,
    PlatformDatabaseModule,
    ExperimentIsolationModule,
    WorkerQueueModule,
    MetricsPipelineModule,
  ],
  providers: [
    K6BenchmarkExecutor,
    K6ProgressMapper,
    BenchmarkProgressStore,
    BenchmarkWorkerProcessor,
  ],
})
export class BenchmarkWorkerModule {}
