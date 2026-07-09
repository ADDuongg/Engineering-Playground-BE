import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  BenchmarkProgressSnapshot,
  BENCHMARK_PROGRESS_LOG_EVENTS,
  benchmarkProgressChannel,
  benchmarkProgressKey,
} from '@db-play/types';
import { RedisService } from '../../../common/services/redis.service';

export type ProgressMessageHandler = (
  snapshot: BenchmarkProgressSnapshot,
) => void;

@Injectable()
export class BenchmarkProgressStore implements OnModuleDestroy {
  private readonly logger = new Logger(BenchmarkProgressStore.name);
  private subscriber: Redis | null = null;
  private readonly handlers = new Map<string, Set<ProgressMessageHandler>>();

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
      this.subscriber = null;
    }
  }

  async get(jobId: string): Promise<BenchmarkProgressSnapshot | null> {
    const raw = await this.redisService
      .getClient()
      .get(benchmarkProgressKey(jobId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as BenchmarkProgressSnapshot;
  }

  async saveAndPublish(snapshot: BenchmarkProgressSnapshot): Promise<void> {
    const ttl = this.configService.get<number>(
      'benchmark.progressTtlSeconds',
      86400,
    );
    const key = benchmarkProgressKey(snapshot.jobId);
    const channel = benchmarkProgressChannel(snapshot.jobId);
    const payload = JSON.stringify(snapshot);

    await this.redisService.getClient().set(key, payload, 'EX', ttl);
    await this.redisService.getClient().publish(channel, payload);

    this.logger.log({
      event: BENCHMARK_PROGRESS_LOG_EVENTS.PUBLISHED,
      jobId: snapshot.jobId,
      phase: snapshot.phase,
      hasPartialMetrics: (snapshot.partialMetrics?.length ?? 0) > 0,
      terminal: snapshot.terminal,
    });
  }

  /**
   * Subscribe to progress updates for a job. Returns an unsubscribe function.
   * Uses a shared Redis subscriber connection (duplicate of the main client).
   */
  async subscribe(
    jobId: string,
    handler: ProgressMessageHandler,
  ): Promise<() => Promise<void>> {
    const channel = benchmarkProgressChannel(jobId);
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);

    const sub = await this.ensureSubscriber();
    if (set.size === 1) {
      await sub.subscribe(channel);
    }

    return async () => {
      const current = this.handlers.get(channel);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        this.handlers.delete(channel);
        await sub.unsubscribe(channel).catch(() => undefined);
      }
    };
  }

  private async ensureSubscriber(): Promise<Redis> {
    if (this.subscriber) {
      return this.subscriber;
    }

    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password =
      this.configService.get<string>('redis.password') || undefined;

    this.subscriber = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    await this.subscriber.connect();

    this.subscriber.on('message', (channel, message) => {
      const set = this.handlers.get(channel);
      if (!set || set.size === 0) {
        return;
      }
      try {
        const snapshot = JSON.parse(message) as BenchmarkProgressSnapshot;
        for (const handler of set) {
          handler(snapshot);
        }
      } catch {
        this.logger.warn({
          event: 'benchmark_progress_parse_failed',
          channel,
        });
      }
    });

    return this.subscriber;
  }
}
