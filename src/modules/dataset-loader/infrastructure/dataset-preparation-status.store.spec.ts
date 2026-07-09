import { ConfigService } from '@nestjs/config';
import {
  DatasetPreparationStatus,
  DatasetReadinessStatus,
  DatasetTier,
} from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';
import { DatasetPreparationStatusStore } from './dataset-preparation-status.store';

describe('DatasetPreparationStatusStore', () => {
  const redisData = new Map<string, string>();
  const redisClient = {
    get: jest.fn(async (key: string) => redisData.get(key) ?? null),
    set: jest.fn(
      async (key: string, value: string, _ex: string, _ttl: number) => {
        redisData.set(key, value);
        return 'OK';
      },
    ),
  };

  const redisService = {
    getClient: () => redisClient,
  } as unknown as RedisService;

  const configService = {
    get: jest.fn((_key: string, defaultValue?: number) => defaultValue ?? 3600),
  } as unknown as ConfigService;

  const store = new DatasetPreparationStatusStore(redisService, configService);

  beforeEach(() => {
    redisData.clear();
    jest.clearAllMocks();
  });

  it('returns not_started when no status exists', async () => {
    const status = await store.getOrDefault('commerce', 'v1', DatasetTier.TIER_100K);
    expect(status.status).toBe(DatasetReadinessStatus.NOT_STARTED);
  });

  it('marks preparing then ready', async () => {
    await store.markPreparing('commerce', 'v1', DatasetTier.TIER_100K);
    const preparing = await store.get('commerce', 'v1', DatasetTier.TIER_100K);
    expect(preparing?.status).toBe(DatasetReadinessStatus.PREPARING);

    await store.markReady('commerce', 'v1', DatasetTier.TIER_100K, new Date().toISOString(), 1200);
    const ready = await store.get('commerce', 'v1', DatasetTier.TIER_100K);
    expect(ready?.status).toBe(DatasetReadinessStatus.READY);
    expect(ready?.durationMs).toBe(1200);
  });

  it('marks failed with error details', async () => {
    const startedAt = new Date().toISOString();
    await store.markFailed('commerce', 'v1', DatasetTier.TIER_100K, startedAt, {
      code: 'SEED_EXECUTION_FAILED',
      message: 'failed',
    });

    const failed = (await store.get(
      'commerce',
      'v1',
      DatasetTier.TIER_100K,
    )) as DatasetPreparationStatus;

    expect(failed.status).toBe(DatasetReadinessStatus.FAILED);
    expect(failed.error?.code).toBe('SEED_EXECUTION_FAILED');
  });

  it('marks resetting then ready', async () => {
    await store.markResetting('commerce', 'v1', DatasetTier.TIER_100K);
    const resetting = await store.get('commerce', 'v1', DatasetTier.TIER_100K);
    expect(resetting?.status).toBe(DatasetReadinessStatus.RESETTING);

    await store.markReady(
      'commerce',
      'v1',
      DatasetTier.TIER_100K,
      new Date().toISOString(),
      800,
    );
    const ready = await store.get('commerce', 'v1', DatasetTier.TIER_100K);
    expect(ready?.status).toBe(DatasetReadinessStatus.READY);
    expect(ready?.durationMs).toBe(800);
  });

  it('uses session-scoped keys when sessionId is provided', async () => {
    await store.markPreparing(
      'commerce',
      'v1',
      DatasetTier.TIER_100K,
      'session-a',
    );

    const global = await store.get('commerce', 'v1', DatasetTier.TIER_100K);
    const scoped = await store.get(
      'commerce',
      'v1',
      DatasetTier.TIER_100K,
      'session-a',
    );

    expect(global).toBeNull();
    expect(scoped?.status).toBe(DatasetReadinessStatus.PREPARING);
    expect(store.buildKey('commerce', 'v1', DatasetTier.TIER_100K, 'session-a')).toBe(
      'dataset:prep:session-a:commerce:v1:100k',
    );
  });
});
