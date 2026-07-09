import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { PlatformDatabaseModule } from '../../src/database/platform/platform-database.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { ErrorCode } from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfPlatform = platformConfigured ? describe : describe.skip;

describeIfPlatform('Auth (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const testEmail = `auth-test-${testRunId}@example.com`;
  const testPassword = 'password123';
  const testDisplayName = 'Auth Test User';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
        PlatformDatabaseModule,
        AuthModule,
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
  }, 60_000);

  afterAll(async () => {
    if (platformDataSource?.isInitialized) {
      await platformDataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'auth-test-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'auth-test-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  it('registers a new user and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.user.displayName).toBe(testDisplayName);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toHaveLength(128);
    expect(res.body.data.tokens.tokenType).toBe('Bearer');
  });

  it('returns conflict when email is already registered', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: 'Duplicate User',
      })
      .expect(HttpStatus.CONFLICT);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.CONFLICT);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('returns unauthorized for invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'wrong-password' })
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns profile for authenticated user', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(HttpStatus.OK);

    const accessToken = login.body.data.tokens.accessToken as string;

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data.displayName).toBe(testDisplayName);
  });

  it('returns unauthorized for /me without bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('rotates tokens on refresh and invalidates old refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(HttpStatus.OK);

    const oldRefresh = login.body.data.tokens.refreshToken as string;

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(HttpStatus.OK);

    expect(refresh.body.data.tokens.refreshToken).not.toBe(oldRefresh);

    const retry = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(HttpStatus.UNAUTHORIZED);

    expect(retry.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('logs out and prevents refresh with revoked token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(HttpStatus.OK);

    const accessToken = login.body.data.tokens.accessToken as string;
    const refreshToken = login.body.data.tokens.refreshToken as string;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(HttpStatus.NO_CONTENT);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);

    expect(refresh.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });
});
