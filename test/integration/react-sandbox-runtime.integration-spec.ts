import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import {
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { RedisModule } from '../../src/common/services/redis.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { RateLimitModule } from '../../src/modules/rate-limit/rate-limit.module';
import { RuntimeAdapterModule } from '../../src/modules/runtime-adapter/runtime-adapter.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;
const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;

const describeIfInfra =
  platformConfigured && playgroundConfigured && redisConfigured
    ? describe
    : describe.skip;

describeIfInfra('React Sandbox Runtime (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;
  let accessToken: string;

  const testEmail = `react-runtime-${Date.now()}@example.com`;
  const testPassword = 'password123';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        EventEmitterModule.forRoot(),
        PlatformDatabaseModule,
        PlaygroundDatabaseModule,
        RedisModule,
        AuthModule,
        RateLimitModule,
        RuntimeAdapterModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    platformDataSource = moduleRef.get(getDataSourceToken('platform'));
    await platformDataSource.runMigrations();

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: 'React Runtime',
      })
      .expect(HttpStatus.CREATED);

    accessToken = registerRes.body.data.tokens.accessToken as string;
  }, 90_000);

  afterAll(async () => {
    try {
      if (platformDataSource?.isInitialized) {
        await platformDataSource.query(
          `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
          [testEmail],
        );
        await platformDataSource.query(`DELETE FROM users WHERE email = $1`, [
          testEmail,
        ]);
      }
    } catch {
      // best-effort cleanup
    }
    try {
      await app?.close();
    } catch {
      // redis may already be closed
    }
    try {
      await moduleRef?.close();
    } catch {
      // ignore duplicate shutdown
    }
  });

  it('runs rendering/counter for allowlisted lab', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/experiments/react/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        action: 'update_state',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
        trackSlug: 'frontend-react',
        interactions: [{ type: 'click' }, { type: 'click' }],
      })
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.data.adapterType).toBe('headless_react_sandbox');
    expect(
      res.body.data.metrics.some(
        (m: { key: string }) => m.key === 'render_count',
      ),
    ).toBe(true);
  });

  it('rejects cross-lab fixture', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/experiments/react/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        action: 'render_component',
        fixtureId: 'keys/list',
        labSlug: 'react-rendering',
      })
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body.success).toBe(false);
  });

  it('rejects unauthenticated callers', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/experiments/react/run')
      .send({
        action: 'render_component',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('rejects componentSource', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/experiments/react/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        action: 'render_component',
        fixtureId: 'rendering/counter',
        labSlug: 'react-rendering',
        componentSource: 'function App(){return null}',
      })
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.success).toBe(false);
  });
});
