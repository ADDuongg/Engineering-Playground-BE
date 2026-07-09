import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../common/services/redis.module';
import { RateLimitService } from './application/rate-limit.service';

@Global()
@Module({
  imports: [ConfigModule, RedisModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
