import { ConfigService } from '@nestjs/config';
import {
  BenchmarkJobStatus,
  BenchmarkProgressSnapshot,
  benchmarkProgressChannel,
  benchmarkProgressKey,
} from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';
import { BenchmarkProgressStore } from './benchmark-progress.store';

describe('BenchmarkProgressStore', () => {
  const redisData = new Map<string, string>();

  const redisClient = {
    get: jest.fn(async (key: string) => redisData.get(key) ?? null),
    set: jest.fn(
      async (key: string, value: string, _ex: string, _ttl: number) => {
        redisData.set(key, value);
        return 'OK';
      },
    ),
    publish: jest.fn(async () => 1),
  };

  const redisService = {
    getClient: () => redisClient,
  } as unknown as RedisService;

  const configService = {
    get: jest.fn((_key: string, defaultValue?: number) => defaultValue ?? 86400),
  } as unknown as ConfigService;

  let store: BenchmarkProgressStore;

  beforeEach(() => {
    redisData.clear();
    jest.clearAllMocks();
    store = new BenchmarkProgressStore(redisService, configService);
  });

  it('saves latest snapshot and publishes on channel', async () => {
    const snapshot: BenchmarkProgressSnapshot = {
      jobId: 'job-1',
      phase: BenchmarkJobStatus.RUNNING,
      elapsedMs: 1000,
      elapsedBasis: 'execution',
      currentRps: 50,
      provisional: true,
      terminal: false,
      updatedAt: '2026-07-09T00:00:00.000Z',
    };

    await store.saveAndPublish(snapshot);

    expect(redisClient.set).toHaveBeenCalledWith(
      benchmarkProgressKey('job-1'),
      JSON.stringify(snapshot),
      'EX',
      86400,
    );
    expect(redisClient.publish).toHaveBeenCalledWith(
      benchmarkProgressChannel('job-1'),
      JSON.stringify(snapshot),
    );
    expect(await store.get('job-1')).toEqual(snapshot);
  });

  it('returns null when snapshot missing', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('unsubscribes and releases channel when last observer leaves', async () => {
    const sub = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    jest
      .spyOn(
        store as unknown as { ensureSubscriber: () => Promise<typeof sub> },
        'ensureSubscriber',
      )
      .mockResolvedValue(sub as never);

    const received: BenchmarkProgressSnapshot[] = [];
    const unsub = await store.subscribe('job-2', (s) => received.push(s));
    const channel = benchmarkProgressChannel('job-2');

    expect(sub.subscribe).toHaveBeenCalledWith(channel);

    const handlers = (
      store as unknown as {
        handlers: Map<string, Set<(s: BenchmarkProgressSnapshot) => void>>;
      }
    ).handlers.get(channel);
    expect(handlers?.size).toBe(1);

    handlers?.forEach((h) =>
      h({
        jobId: 'job-2',
        phase: BenchmarkJobStatus.RUNNING,
        elapsedMs: 10,
        elapsedBasis: 'execution',
        provisional: true,
        terminal: false,
        updatedAt: new Date().toISOString(),
      }),
    );
    expect(received).toHaveLength(1);

    await unsub();
    expect(sub.unsubscribe).toHaveBeenCalledWith(channel);
    expect(
      (
        store as unknown as {
          handlers: Map<string, Set<unknown>>;
        }
      ).handlers.get(channel),
    ).toBeUndefined();
  });
});
