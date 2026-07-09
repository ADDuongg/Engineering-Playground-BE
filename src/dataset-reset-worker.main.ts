import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DatasetResetWorkerModule } from './workers/dataset-reset-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    DatasetResetWorkerModule,
    {
      bufferLogs: true,
    },
  );

  const logger = new Logger('DatasetResetWorker');
  logger.log('Dataset reset worker started');

  app.enableShutdownHooks();
}

bootstrap();
