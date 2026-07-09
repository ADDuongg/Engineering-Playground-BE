import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../common/services/redis.module';
import { WorkerQueueController } from './worker-queue.controller';
import { GetJobStatusUseCase } from './application/get-job-status.usecase';
import { CancelSessionJobsUseCase } from './application/cancel-session-jobs.usecase';
import { EnqueueJobService } from './application/enqueue-job.service';
import { JobStore } from './infrastructure/job.store';
import { JobQueueProducer } from './infrastructure/job-queue.producer';
import { DeadLetterLogger } from './infrastructure/dead-letter.logger';

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [WorkerQueueController],
  providers: [
    JobStore,
    JobQueueProducer,
    DeadLetterLogger,
    EnqueueJobService,
    GetJobStatusUseCase,
    CancelSessionJobsUseCase,
  ],
  exports: [
    JobStore,
    JobQueueProducer,
    DeadLetterLogger,
    EnqueueJobService,
    GetJobStatusUseCase,
    CancelSessionJobsUseCase,
  ],
})
export class WorkerQueueModule {}
