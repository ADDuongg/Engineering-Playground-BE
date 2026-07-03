import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { RedisService } from '../common/services/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redisService: RedisService,
    @InjectDataSource('platform')
    private readonly platformDataSource: DataSource,
    @InjectDataSource('playground')
    private readonly playgroundDataSource: DataSource,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check for platform DB, playground DB, and Redis' })
  check() {
    return this.health.check([
      () =>
        this.db.pingCheck('platform_db', {
          connection: this.platformDataSource,
        }),
      () =>
        this.db.pingCheck('playground_db', {
          connection: this.playgroundDataSource,
        }),
      async () => {
        const isHealthy = await this.redisService.ping();
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
          },
        };
      },
    ]);
  }
}
