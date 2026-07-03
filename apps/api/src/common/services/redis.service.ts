import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result === 'PONG';
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
