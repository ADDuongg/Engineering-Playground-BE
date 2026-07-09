import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import configuration from '../config/configuration';
import { envValidationSchema } from '../config/env.validation';
import { RedisModule } from '../common/services/redis.module';
import { PlatformDatabaseModule } from '../database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../database/playground/playground-database.module';
import { DatasetLoaderModule } from '../modules/dataset-loader/dataset-loader.module';
import { WorkerQueueModule } from '../modules/worker-queue/worker-queue.module';
import { RateLimitModule } from '../modules/rate-limit/rate-limit.module';
import { DatasetResetWorkerProcessor } from './dataset-reset-worker.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '.env'),
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),
    RedisModule,
    PlatformDatabaseModule,
    PlaygroundDatabaseModule,
    RateLimitModule,
    WorkerQueueModule,
    DatasetLoaderModule,
  ],
  providers: [DatasetResetWorkerProcessor],
})
export class DatasetResetWorkerModule {}
