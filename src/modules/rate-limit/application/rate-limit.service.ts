import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorCode,
  RATE_LIMIT_OPERATION_LABELS,
  RateLimitOperation,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { RedisService } from '../../../common/services/redis.service';

export interface RateLimitConsumeInput {
  operation: RateLimitOperation;
  userId?: string;
  sessionId?: string;
}

const CONSUME_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
  return 0
end
return 1
`;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async consumeQuota(input: RateLimitConsumeInput): Promise<void> {
    const identity = this.resolveIdentity(input.userId, input.sessionId);
    const limit = this.resolveLimit(input.operation, input.userId);
    const windowSeconds = this.configService.get<number>(
      'rateLimit.windowSeconds',
      60,
    );
    const windowBucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:${input.operation}:${identity.type}:${identity.id}:${windowBucket}`;

    try {
      const allowed = await this.redisService
        .getClient()
        .eval(
          CONSUME_SCRIPT,
          1,
          key,
          limit,
          windowSeconds + 1,
        );

      if (allowed === 1) {
        return;
      }

      const retryAfterSeconds = this.computeRetryAfterSeconds(windowSeconds);
      this.logRejection(input.operation, identity, retryAfterSeconds);
      throw this.buildLimitExceededError(input.operation, retryAfterSeconds);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      this.logger.error(
        {
          event: 'rate_limit_storage_error',
          operation: input.operation,
          identityType: identity.type,
          identityId: identity.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Rate limit storage unavailable',
      );

      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        'Rate limiting is temporarily unavailable. Try again shortly.',
        503,
        { reason: 'RATE_LIMIT_STORAGE_UNAVAILABLE' },
      );
    }
  }

  private resolveIdentity(
    userId?: string,
    sessionId?: string,
  ): { type: 'user' | 'session'; id: string } {
    if (userId) {
      return { type: 'user', id: userId };
    }

    if (sessionId) {
      return { type: 'session', id: sessionId };
    }

    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'An experiment session or signed-in account is required for this operation.',
      400,
      { reason: 'RATE_LIMIT_IDENTITY_REQUIRED' },
    );
  }

  private resolveLimit(operation: RateLimitOperation, userId?: string): number {
    const baseLimit = this.getBaseLimit(operation);
    if (!userId || !this.isElevatedUser(userId)) {
      return baseLimit;
    }

    const multiplier = this.configService.get<number>(
      'rateLimit.elevatedMultiplier',
      5,
    );
    return baseLimit * multiplier;
  }

  private getBaseLimit(operation: RateLimitOperation): number {
    switch (operation) {
      case RateLimitOperation.SQL_RUN:
        return this.configService.get<number>('rateLimit.sqlRun', 30);
      case RateLimitOperation.EXPLAIN_RUN:
        return this.configService.get<number>('rateLimit.explainRun', 10);
      case RateLimitOperation.DATASET_RESET:
        return this.configService.get<number>('rateLimit.datasetReset', 5);
      case RateLimitOperation.BENCHMARK_ENQUEUE:
        return this.configService.get<number>('rateLimit.benchmarkEnqueue', 5);
      default:
        return 30;
    }
  }

  private isElevatedUser(userId: string): boolean {
    if (!this.configService.get<boolean>('rateLimit.elevatedEnabled', false)) {
      return false;
    }

    const elevatedUserIds =
      this.configService.get<string[]>('rateLimit.elevatedUserIds') ?? [];
    return elevatedUserIds.includes(userId);
  }

  private computeRetryAfterSeconds(windowSeconds: number): number {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const elapsedInWindow = nowSeconds % windowSeconds;
    return Math.max(1, windowSeconds - elapsedInWindow);
  }

  private buildLimitExceededError(
    operation: RateLimitOperation,
    retryAfterSeconds: number,
  ): DomainError {
    const operationLabel = RATE_LIMIT_OPERATION_LABELS[operation];

    return new DomainError(
      ErrorCode.RATE_LIMITED,
      `Fair-use limit reached for ${operationLabel}. Try again in ${retryAfterSeconds} seconds.`,
      429,
      {
        reason: 'RATE_LIMIT_EXCEEDED',
        operation,
        operationLabel,
        retryAfterSeconds,
        hint: 'Experiment operations are limited per learner so everyone can use the playground fairly.',
      },
    );
  }

  private logRejection(
    operation: RateLimitOperation,
    identity: { type: 'user' | 'session'; id: string },
    retryAfterSeconds: number,
  ): void {
    this.logger.warn({
      event: 'rate_limit_exceeded',
      operation,
      identityType: identity.type,
      identityId: identity.id,
      retryAfterSeconds,
    });
  }
}
