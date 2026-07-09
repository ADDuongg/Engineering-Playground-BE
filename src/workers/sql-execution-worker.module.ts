import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { join } from 'path';
import configuration from '../config/configuration';
import { envValidationSchema } from '../config/env.validation';
import { RedisModule } from '../common/services/redis.module';
import { PlatformDatabaseModule } from '../database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../database/playground/playground-database.module';
import { RateLimitModule } from '../modules/rate-limit/rate-limit.module';
import { ExperimentRunnerModule } from '../modules/experiment-runner/experiment-runner.module';
import { WorkerQueueModule } from '../modules/worker-queue/worker-queue.module';
import { SqlExecutionWorkerProcessor } from './sql-execution-worker.processor';

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
    PlaygroundDatabaseModule,
    RateLimitModule,
    WorkerQueueModule,
    ExperimentRunnerModule,
  ],
  providers: [SqlExecutionWorkerProcessor],
})
export class SqlExecutionWorkerModule {}
