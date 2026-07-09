import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { BenchmarkWorkerModule } from './workers/benchmark-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(BenchmarkWorkerModule, {
    bufferLogs: true,
  });

  const logger = new Logger('BenchmarkWorker');
  logger.log('Benchmark worker started');

  app.enableShutdownHooks();
}

bootstrap();
