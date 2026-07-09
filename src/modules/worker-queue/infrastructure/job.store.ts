import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BackgroundJob,
  JobFailureReason,
  JobStatus,
  JOB_INFLIGHT_STATUSES,
  JOB_TERMINAL_STATUSES,
} from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';

@Injectable()
export class JobStore {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  buildJobKey(jobId: string): string {
    return `jobs:status:${jobId}`;
  }

  buildSessionJobsKey(sessionId: string): string {
    return `jobs:session:${sessionId}`;
  }

  private ttlSeconds(): number {
    return this.configService.get<number>('jobs.statusTtlSeconds', 86400);
  }

  async save(job: BackgroundJob): Promise<void> {
    const client = this.redisService.getClient();
    const ttl = this.ttlSeconds();

    await client.set(this.buildJobKey(job.id), JSON.stringify(job), 'EX', ttl);

    if (job.sessionId) {
      await client.sadd(this.buildSessionJobsKey(job.sessionId), job.id);
      await client.expire(this.buildSessionJobsKey(job.sessionId), ttl);
    }
  }

  async getById(jobId: string): Promise<BackgroundJob | null> {
    const raw = await this.redisService
      .getClient()
      .get(this.buildJobKey(jobId));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as BackgroundJob;
  }

  async update(job: BackgroundJob): Promise<void> {
    await this.save(job);
  }

  async delete(jobId: string): Promise<void> {
    const job = await this.getById(jobId);
    const client = this.redisService.getClient();
    await client.del(this.buildJobKey(jobId));

    if (job?.sessionId) {
      await client.srem(this.buildSessionJobsKey(job.sessionId), jobId);
    }
  }

  async listBySession(sessionId: string): Promise<BackgroundJob[]> {
    const client = this.redisService.getClient();
    const jobIds = await client.smembers(this.buildSessionJobsKey(sessionId));

    if (jobIds.length === 0) {
      return [];
    }

    const jobs: BackgroundJob[] = [];
    for (const jobId of jobIds) {
      const job = await this.getById(jobId);
      if (job) {
        jobs.push(job);
      } else {
        await client.srem(this.buildSessionJobsKey(sessionId), jobId);
      }
    }

    return jobs;
  }

  async countInflightBySession(
    sessionId: string,
    jobType?: BackgroundJob['jobType'],
  ): Promise<number> {
    const jobs = await this.listBySession(sessionId);
    return jobs.filter(
      (job) =>
        JOB_INFLIGHT_STATUSES.includes(job.status) &&
        (jobType === undefined || job.jobType === jobType),
    ).length;
  }

  async markRunning(job: BackgroundJob): Promise<BackgroundJob> {
    const updated: BackgroundJob = {
      ...job,
      status: JobStatus.RUNNING,
      startedAt: job.startedAt ?? new Date().toISOString(),
      attemptCount: job.attemptCount + 1,
      completedAt: undefined,
      failureReason: undefined,
      failureMessage: undefined,
      deadLetteredAt: undefined,
    };
    await this.update(updated);
    return updated;
  }

  async markCompleted(job: BackgroundJob): Promise<BackgroundJob> {
    const updated: BackgroundJob = {
      ...job,
      status: JobStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    };
    await this.update(updated);
    return updated;
  }

  async markFailed(
    job: BackgroundJob,
    reason: JobFailureReason,
    message: string,
    options?: { deadLetter?: boolean },
  ): Promise<BackgroundJob> {
    const updated: BackgroundJob = {
      ...job,
      status: JobStatus.FAILED,
      completedAt: new Date().toISOString(),
      failureReason: reason,
      failureMessage: message,
      deadLetteredAt: options?.deadLetter
        ? new Date().toISOString()
        : job.deadLetteredAt,
    };
    await this.update(updated);
    return updated;
  }

  async markCancelled(job: BackgroundJob): Promise<BackgroundJob> {
    if (JOB_TERMINAL_STATUSES.includes(job.status)) {
      return job;
    }

    const updated: BackgroundJob = {
      ...job,
      status: JobStatus.CANCELLED,
      completedAt: new Date().toISOString(),
    };
    await this.update(updated);
    return updated;
  }
}
