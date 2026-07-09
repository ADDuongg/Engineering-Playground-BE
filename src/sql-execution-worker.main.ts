import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SqlExecutionWorkerModule } from './workers/sql-execution-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    SqlExecutionWorkerModule,
    {
      bufferLogs: true,
    },
  );

  const logger = new Logger('SqlExecutionWorker');
  logger.log('SQL execution worker started');

  app.enableShutdownHooks();
}

bootstrap();
