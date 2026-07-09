import { firstValueFrom, take, toArray } from 'rxjs';
import {
  BenchmarkJobStatus,
  ErrorCode,
  JobStatus,
  JobType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { JobStore } from '../../worker-queue/infrastructure/job.store';
import { BenchmarkProgressStore } from '../infrastructure/benchmark-progress.store';
import { ObserveBenchmarkProgressUseCase } from './observe-benchmark-progress.usecase';

describe('ObserveBenchmarkProgressUseCase', () => {
  let jobStore: jest.Mocked<Pick<JobStore, 'getById'>>;
  let progressStore: jest.Mocked<
    Pick<BenchmarkProgressStore, 'get' | 'subscribe'>
  >;
  let useCase: ObserveBenchmarkProgressUseCase;

  const baseJob = {
    id: 'job-1',
    jobType: JobType.BENCHMARK,
    status: JobStatus.QUEUED,
    createdAt: new Date(Date.now() - 5000).toISOString(),
    userId: 'user-1',
    sessionId: 'session-1',
    payloadSummary: { profile: { rps: 100, durationSeconds: 10 } },
    attemptCount: 0,
    maxAttempts: 2,
  };

  beforeEach(() => {
    jobStore = {
      getById: jest.fn().mockResolvedValue(baseJob),
    };
    progressStore = {
      get: jest.fn().mockResolvedValue(null),
      subscribe: jest.fn().mockResolvedValue(async () => undefined),
    };
    useCase = new ObserveBenchmarkProgressUseCase(
      jobStore as unknown as JobStore,
      progressStore as unknown as BenchmarkProgressStore,
    );
  });

  it('denies access for non-owners', async () => {
    const stream = useCase.execute({
      jobId: 'job-1',
      userId: 'other-user',
      sessionId: 'other-session',
    });

    await expect(firstValueFrom(stream)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('seeds queued phase/elapsed without inventing RPS when snapshot missing', async () => {
    const events = await firstValueFrom(
      useCase.execute({ jobId: 'job-1', sessionId: 'session-1' }).pipe(
        take(1),
        toArray(),
      ),
    );

    expect(events[0].type).toBe('progress');
    if (events[0].type === 'progress') {
      expect(events[0].data.phase).toBe(BenchmarkJobStatus.QUEUED);
      expect(events[0].data.elapsedBasis).toBe('queue');
      expect(events[0].data.currentRps).toBeNull();
      expect(events[0].data.partialMetrics).toBeUndefined();
      expect(events[0].data.provisional).toBe(true);
      expect(events[0].data.terminal).toBe(false);
    }
  });

  it('emits latest redis snapshot when present', async () => {
    progressStore.get.mockResolvedValue({
      jobId: 'job-1',
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: 2500,
      elapsedBasis: 'execution',
      currentRps: 88,
      partialMetrics: [
        {
          key: 'achieved_rps',
          label: 'Achieved RPS',
          unit: 'rps',
          value: 88,
          group: 'throughput',
          provisional: true,
        },
      ],
      provisional: true,
      terminal: false,
      updatedAt: new Date().toISOString(),
    });

    const events = await firstValueFrom(
      useCase.execute({ jobId: 'job-1', userId: 'user-1' }).pipe(
        take(1),
        toArray(),
      ),
    );

    expect(events[0].type).toBe('progress');
    if (events[0].type === 'progress') {
      expect(events[0].data.currentRps).toBe(88);
      expect(events[0].data.partialMetrics?.[0].provisional).toBe(true);
    }
  });

  it('emits terminal immediately for completed jobs', async () => {
    jobStore.getById.mockResolvedValue({
      ...baseJob,
      status: JobStatus.COMPLETED,
      startedAt: new Date(Date.now() - 10_000).toISOString(),
      completedAt: new Date().toISOString(),
    });

    const events = await firstValueFrom(
      useCase
        .execute({ jobId: 'job-1', sessionId: 'session-1' })
        .pipe(toArray()),
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('terminal');
    if (events[0].type === 'terminal') {
      expect(events[0].data.terminal).toBe(true);
      expect(events[0].data.phase).toBe(BenchmarkJobStatus.COMPLETED);
      expect(
        (events[0].data as { metrics?: unknown }).metrics,
      ).toBeUndefined();
    }
  });

  it('forwards subscribed updates then closes on terminal', async () => {
    let handler: ((s: unknown) => void) | undefined;
    progressStore.get.mockResolvedValue({
      jobId: 'job-1',
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: 100,
      elapsedBasis: 'execution',
      provisional: true,
      terminal: false,
      updatedAt: new Date().toISOString(),
    });
    progressStore.subscribe.mockImplementation(async (_id, h) => {
      handler = h as (s: unknown) => void;
      return async () => undefined;
    });

    const collected: string[] = [];
    await new Promise<void>((resolve, reject) => {
      useCase.execute({ jobId: 'job-1', userId: 'user-1' }).subscribe({
        next: (e) => {
          collected.push(e.type);
        },
        error: reject,
        complete: () => resolve(),
      });

      // Wait until subscribe registers the handler, then publish terminal.
      const waitForHandler = async () => {
        for (let i = 0; i < 50; i++) {
          if (handler) {
            handler({
              jobId: 'job-1',
              phase: BenchmarkJobStatus.COMPLETED,
              elapsedMs: 10000,
              elapsedBasis: 'execution',
              provisional: true,
              terminal: true,
              updatedAt: new Date().toISOString(),
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        reject(new Error('subscribe handler was never registered'));
      };
      void waitForHandler();
    });

    expect(collected).toEqual(['progress', 'terminal']);
  });

  it('rejects unknown jobs', async () => {
    jobStore.getById.mockResolvedValue(null);
    await expect(
      firstValueFrom(useCase.execute({ jobId: 'x', sessionId: 's' })),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
