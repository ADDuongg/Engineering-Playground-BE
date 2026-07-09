import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Global HTTP throttle backstop. Benchmark load tests authenticate with
 * `X-Benchmark-Internal-Token` and must not be capped by the 100/min default —
 * otherwise k6 at ≥100 RPS records ~100% HTTP failures (429).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    if (await super.shouldSkip(context)) {
      return true;
    }

    if (context.getType() !== 'http') {
      return false;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers?.['x-benchmark-internal-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) {
      return false;
    }

    const expected = this.configService.get<string>(
      'benchmark.internalSecret',
      'benchmark-internal-dev',
    );

    return token === expected;
  }
}
