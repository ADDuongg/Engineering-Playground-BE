import { ConfigService } from '@nestjs/config';
import { ErrorCode, RateLimitOperation } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { RedisService } from '../../../common/services/redis.service';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  const redisEval = jest.fn();
  const redisClient = { eval: redisEval };
  const redisService = {
    getClient: () => redisClient,
  } as unknown as RedisService;

  const configValues: Record<string, unknown> = {
    'rateLimit.windowSeconds': 60,
    'rateLimit.sqlRun': 2,
    'rateLimit.explainRun': 10,
    'rateLimit.datasetReset': 5,
    'rateLimit.benchmarkEnqueue': 5,
    'rateLimit.elevatedEnabled': false,
    'rateLimit.elevatedUserIds': [],
    'rateLimit.elevatedMultiplier': 5,
  };

  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      configValues[key] ?? defaultValue,
    ),
  } as unknown as ConfigService;

  const service = new RateLimitService(redisService, configService);

  beforeEach(() => {
    jest.clearAllMocks();
    configValues['rateLimit.elevatedEnabled'] = false;
    configValues['rateLimit.elevatedUserIds'] = [];
  });

  it('consumes quota when under limit', async () => {
    redisEval.mockResolvedValue(1);

    await expect(
      service.consumeQuota({
        operation: RateLimitOperation.SQL_RUN,
        userId: 'user-1',
      }),
    ).resolves.toBeUndefined();

    expect(redisEval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringContaining('ratelimit:sql_run:user:user-1:'),
      2,
      61,
    );
  });

  it('throws RATE_LIMITED when quota exceeded', async () => {
    redisEval.mockResolvedValue(0);

    await expect(
      service.consumeQuota({
        operation: RateLimitOperation.EXPLAIN_RUN,
        sessionId: 'session-1',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMITED,
      statusCode: 429,
      details: expect.objectContaining({
        reason: 'RATE_LIMIT_EXCEEDED',
        operation: RateLimitOperation.EXPLAIN_RUN,
        operationLabel: 'EXPLAIN',
        retryAfterSeconds: expect.any(Number),
      }),
    });
  });

  it('requires user or session identity', async () => {
    await expect(
      service.consumeQuota({
        operation: RateLimitOperation.SQL_RUN,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('prefers user identity over session', async () => {
    redisEval.mockResolvedValue(1);

    await service.consumeQuota({
      operation: RateLimitOperation.SQL_RUN,
      userId: 'user-1',
      sessionId: 'session-1',
    });

    expect(redisEval.mock.calls[0][2]).toContain(':user:user-1:');
  });

  it('applies elevated multiplier for configured users', async () => {
    configValues['rateLimit.elevatedEnabled'] = true;
    configValues['rateLimit.elevatedUserIds'] = ['admin-1'];
    redisEval.mockResolvedValue(1);

    await service.consumeQuota({
      operation: RateLimitOperation.SQL_RUN,
      userId: 'admin-1',
    });

    expect(redisEval.mock.calls[0][3]).toBe(10);
  });

  it('fails closed when redis is unavailable', async () => {
    redisEval.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.consumeQuota({
        operation: RateLimitOperation.SQL_RUN,
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      details: { reason: 'RATE_LIMIT_STORAGE_UNAVAILABLE' },
    });
  });
});
