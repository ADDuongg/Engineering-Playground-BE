import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from '../src/health/health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisService } from '../src/common/services/redis.service';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    isInitialized: true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: {
                platform_db: { status: 'up' },
                playground_db: { status: 'up' },
                redis: { status: 'up' },
              },
              error: {},
              details: {
                platform_db: { status: 'up' },
                playground_db: { status: 'up' },
                redis: { status: 'up' },
              },
            }),
          },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: {
            pingCheck: jest.fn().mockResolvedValue({ status: 'up' }),
          },
        },
        {
          provide: RedisService,
          useValue: { ping: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: getDataSourceToken('platform'),
          useValue: mockDataSource,
        },
        {
          provide: getDataSourceToken('playground'),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });
});
