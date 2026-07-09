import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  BackgroundJob,
  BENCHMARK_PROGRESS_LOG_EVENTS,
  BenchmarkJobStatus,
  BenchmarkProfile,
  BenchmarkProgressSnapshot,
  ErrorCode,
  JobStatus,
  JobType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { BenchmarkProgressStore } from '../infrastructure/benchmark-progress.store';

export interface ObserveBenchmarkProgressInput {
  jobId: string;
  userId?: string;
  sessionId?: string;
}

export type BenchmarkProgressSseEvent =
  | { type: 'progress'; data: BenchmarkProgressSnapshot }
  | { type: 'terminal'; data: BenchmarkProgressSnapshot }
  | { type: 'error'; data: { code: string; message: string } };

@Injectable()
export class ObserveBenchmarkProgressUseCase {
  private readonly logger = new Logger(ObserveBenchmarkProgressUseCase.name);

  constructor(
    private readonly jobStore: JobStore,
    private readonly progressStore: BenchmarkProgressStore,
  ) {}

  execute(
    input: ObserveBenchmarkProgressInput,
  ): Observable<BenchmarkProgressSseEvent> {
    return new Observable((subscriber) => {
      let unsubscribe: (() => Promise<void>) | null = null;
      let closed = false;

      const cleanup = (reason: string) => {
        if (closed) {
          return;
        }
        closed = true;
        if (unsubscribe) {
          void unsubscribe().catch(() => undefined);
          unsubscribe = null;
        }
        this.logger.log({
          event: BENCHMARK_PROGRESS_LOG_EVENTS.OBSERVE_END,
          jobId: input.jobId,
          reason,
        });
        if (!subscriber.closed) {
          subscriber.complete();
        }
      };

      void (async () => {
        try {
          const job = await this.jobStore.getById(input.jobId);

          if (!job || job.jobType !== JobType.BENCHMARK) {
            throw new DomainError(
              ErrorCode.NOT_FOUND,
              'Benchmark job was not found.',
              404,
              {
                reason: 'BENCHMARK_JOB_NOT_FOUND',
                hint: 'Verify the job identifier or start a new benchmark.',
              },
            );
          }

          this.assertOwnership(
            job.userId,
            job.sessionId,
            input.userId,
            input.sessionId,
          );

          let seededFromStatus = false;
          let initial = await this.progressStore.get(input.jobId);

          if (!initial) {
            if (this.isTerminalJob(job.status)) {
              initial = this.buildTerminalFromJob(job);
            } else {
              initial = this.seedFromJob(job);
              seededFromStatus = true;
            }
          }

          this.logger.log({
            event: BENCHMARK_PROGRESS_LOG_EVENTS.OBSERVE_START,
            jobId: input.jobId,
            seededFromStatus,
            phase: initial.phase,
            terminal: initial.terminal,
          });

          if (closed || subscriber.closed) {
            return;
          }

          if (initial.terminal || this.isTerminalPhase(initial.phase)) {
            subscriber.next({
              type: 'terminal',
              data: { ...initial, terminal: true, provisional: true },
            });
            cleanup('terminal');
            return;
          }

          subscriber.next({ type: 'progress', data: initial });

          unsubscribe = await this.progressStore.subscribe(
            input.jobId,
            (snapshot) => {
              if (closed || subscriber.closed) {
                return;
              }
              if (snapshot.terminal || this.isTerminalPhase(snapshot.phase)) {
                subscriber.next({
                  type: 'terminal',
                  data: { ...snapshot, terminal: true, provisional: true },
                });
                cleanup('terminal');
                return;
              }
              subscriber.next({ type: 'progress', data: snapshot });
            },
          );

          if (closed || subscriber.closed) {
            if (unsubscribe) {
              await unsubscribe().catch(() => undefined);
            }
            return;
          }

          const latestJob = await this.jobStore.getById(input.jobId);
          if (latestJob && this.isTerminalJob(latestJob.status)) {
            const terminal =
              (await this.progressStore.get(input.jobId)) ??
              this.buildTerminalFromJob(latestJob);
            subscriber.next({
              type: 'terminal',
              data: { ...terminal, terminal: true, provisional: true },
            });
            cleanup('terminal');
          }
        } catch (error) {
          if (!subscriber.closed) {
            subscriber.error(error);
          }
          cleanup('error');
        }
      })();

      return () => {
        cleanup('disconnect');
      };
    });
  }

  private isTerminalJob(status: JobStatus): boolean {
    return (
      status === JobStatus.COMPLETED ||
      status === JobStatus.FAILED ||
      status === JobStatus.CANCELLED
    );
  }

  private isTerminalPhase(phase: BenchmarkJobStatus): boolean {
    return (
      phase === BenchmarkJobStatus.COMPLETED ||
      phase === BenchmarkJobStatus.FAILED ||
      phase === BenchmarkJobStatus.CANCELLED
    );
  }

  private seedFromJob(job: BackgroundJob): BenchmarkProgressSnapshot {
    const profile = job.payloadSummary?.profile as BenchmarkProfile | undefined;
    const phase = job.status as unknown as BenchmarkJobStatus;
    const now = Date.now();
    const isRunning = job.status === JobStatus.RUNNING && job.startedAt;
    const basisStart = isRunning
      ? new Date(job.startedAt!).getTime()
      : new Date(job.createdAt).getTime();

    return {
      jobId: job.id,
      phase,
      elapsedMs: Math.max(now - basisStart, 0),
      elapsedBasis: isRunning ? 'execution' : 'queue',
      currentRps: null,
      partialMetrics: undefined,
      provisional: true,
      terminal: false,
      profile,
      updatedAt: new Date().toISOString(),
      hint:
        phase === BenchmarkJobStatus.QUEUED
          ? 'Benchmark is waiting in the queue.'
          : undefined,
    };
  }

  private buildTerminalFromJob(job: BackgroundJob): BenchmarkProgressSnapshot {
    const profile = job.payloadSummary?.profile as BenchmarkProfile | undefined;
    const phase = job.status as unknown as BenchmarkJobStatus;
    const end = job.completedAt
      ? new Date(job.completedAt).getTime()
      : Date.now();
    const start = job.startedAt
      ? new Date(job.startedAt).getTime()
      : new Date(job.createdAt).getTime();

    return {
      jobId: job.id,
      phase,
      elapsedMs: Math.max(end - start, 0),
      elapsedBasis: job.startedAt ? 'execution' : 'queue',
      provisional: true,
      terminal: true,
      profile,
      updatedAt: new Date().toISOString(),
      hint: 'Benchmark finished. Use status or metrics APIs for final results.',
    };
  }

  private assertOwnership(
    jobUserId: string | null,
    jobSessionId: string | null,
    callerUserId?: string,
    callerSessionId?: string,
  ): void {
    if (callerUserId && jobUserId && callerUserId === jobUserId) {
      return;
    }

    if (callerSessionId && jobSessionId && callerSessionId === jobSessionId) {
      return;
    }

    throw new DomainError(
      ErrorCode.FORBIDDEN,
      'You do not have access to this benchmark job.',
      403,
      { reason: 'BENCHMARK_JOB_FORBIDDEN' },
    );
  }
}
