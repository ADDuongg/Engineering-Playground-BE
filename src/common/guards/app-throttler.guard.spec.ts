import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  const createGuard = (secret = 'benchmark-internal-dev') => {
    const configService = {
      get: jest.fn((key: string, fallback?: string) =>
        key === 'benchmark.internalSecret' ? secret : fallback,
      ),
    } as unknown as ConfigService;

    const guard = new AppThrottlerGuard(
      [{ ttl: 60_000, limit: 100 }],
      {} as ThrottlerStorage,
      new Reflector(),
      configService,
    );

    jest
      .spyOn(Object.getPrototypeOf(AppThrottlerGuard.prototype), 'shouldSkip')
      .mockResolvedValue(false);

    return guard;
  };

  const httpContext = (token?: string): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          headers: token ? { 'x-benchmark-internal-token': token } : {},
        }),
      }),
    }) as unknown as ExecutionContext;

  it('skips throttle for a valid benchmark internal token', async () => {
    const guard = createGuard();
    await expect(
      guard['shouldSkip'](httpContext('benchmark-internal-dev')),
    ).resolves.toBe(true);
  });

  it('does not skip for a wrong token', async () => {
    const guard = createGuard();
    await expect(guard['shouldSkip'](httpContext('wrong'))).resolves.toBe(
      false,
    );
  });

  it('does not skip when the header is absent', async () => {
    const guard = createGuard();
    await expect(guard['shouldSkip'](httpContext())).resolves.toBe(false);
  });
});
