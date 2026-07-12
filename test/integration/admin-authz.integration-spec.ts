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
import { AdminModule } from '../../src/modules/admin/admin.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { ErrorCode, Role } from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfPlatform = platformConfigured ? describe : describe.skip;

describeIfPlatform('Admin AuthZ (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const userEmail = `admin-authz-user-${testRunId}@example.com`;
  const adminEmail = `admin-authz-admin-${testRunId}@example.com`;
  const password = 'password123';

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
        AdminModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
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
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'admin-authz-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'admin-authz-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  async function registerAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        displayName: 'Admin AuthZ Test',
      })
      .expect(HttpStatus.CREATED);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);

    return login.body.data.tokens.accessToken as string;
  }

  async function promoteToAdmin(email: string): Promise<void> {
    await platformDataSource.query(
      `UPDATE users SET role = $1 WHERE email = $2`,
      [Role.ADMIN, email],
    );
  }

  it('returns 200 for admin whoami after promotion and re-login', async () => {
    await registerAndLogin(adminEmail);
    await promoteToAdmin(adminEmail);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(HttpStatus.OK);

    const accessToken = login.body.data.tokens.accessToken as string;

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(adminEmail);
    expect(res.body.data.role).toBe(Role.ADMIN);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.displayName).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('returns 403 FORBIDDEN for authenticated non-admin', async () => {
    const accessToken = await registerAndLogin(userEmail);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    expect(res.body.error.message).toContain('Admin role required');
  });

  it('returns 401 UNAUTHORIZED without bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('keeps learner GET /auth/me available for standard users while admin me is forbidden', async () => {
    const accessToken = await registerAndLogin(
      `admin-authz-learner-${testRunId}@example.com`,
    );

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(me.body.success).toBe(true);
    expect(me.body.data.role).toBe(Role.USER);

    const adminMe = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(adminMe.body.error.code).toBe(ErrorCode.FORBIDDEN);
  });
});
