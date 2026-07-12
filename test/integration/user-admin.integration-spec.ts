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
import { EventEmitterModule } from '@nestjs/event-emitter';
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

describeIfPlatform('User Admin (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const adminEmail = `user-admin-admin-${testRunId}@example.com`;
  const learnerEmail = `user-admin-learner-${testRunId}@example.com`;
  const otherAdminEmail = `user-admin-other-${testRunId}@example.com`;
  const password = 'password123';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        EventEmitterModule.forRoot(),
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
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'user-admin-%@example.com')`,
      );
      await platformDataSource.query(
        `UPDATE users SET updated_by = NULL WHERE updated_by IN (SELECT id FROM users WHERE email LIKE 'user-admin-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'user-admin-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  async function registerAndLogin(
    email: string,
    displayName = 'User Admin Test',
  ): Promise<{ accessToken: string; userId: string }> {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName })
      .expect(HttpStatus.CREATED);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);

    return {
      accessToken: login.body.data.tokens.accessToken as string,
      userId: register.body.data.user.id as string,
    };
  }

  async function promoteToAdmin(email: string): Promise<void> {
    await platformDataSource.query(
      `UPDATE users SET role = $1 WHERE email = $2`,
      [Role.ADMIN, email],
    );
  }

  async function login(email: string): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);
    return login.body.data.tokens.accessToken as string;
  }

  it('lists/searches users for admin and denies non-admin / unauthenticated', async () => {
    const learner = await registerAndLogin(learnerEmail, 'Learner Target');
    await registerAndLogin(adminEmail, 'Admin Operator');
    await promoteToAdmin(adminEmail);
    const adminToken = await login(adminEmail);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/users?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);

    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.meta.pagination.total).toBeGreaterThanOrEqual(2);
    expect(list.body.data[0]).not.toHaveProperty('passwordHash');
    expect(list.body.data[0]).toHaveProperty('updatedBy');

    const search = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?q=${encodeURIComponent('Learner Target')}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);

    expect(
      search.body.data.some(
        (u: { id: string }) => u.id === learner.userId,
      ),
    ).toBe(true);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${learner.accessToken}`)
      .expect(HttpStatus.FORBIDDEN);
    expect(forbidden.body.error.code).toBe(ErrorCode.FORBIDDEN);

    const unauth = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .expect(HttpStatus.UNAUTHORIZED);
    expect(unauth.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('gets user by id, promotes/demotes with updatedBy, no-op, and last-admin guard', async () => {
    const learner = await registerAndLogin(
      `user-admin-learner2-${testRunId}@example.com`,
      'Learner Two',
    );
    const otherAdmin = await registerAndLogin(otherAdminEmail, 'Other Admin');
    await registerAndLogin(
      `user-admin-primary-${testRunId}@example.com`,
      'Primary Admin',
    );
    await promoteToAdmin(`user-admin-primary-${testRunId}@example.com`);
    await promoteToAdmin(otherAdminEmail);

    const adminToken = await login(
      `user-admin-primary-${testRunId}@example.com`,
    );
    const adminMe = await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);
    const actingAdminId = adminMe.body.data.id as string;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${learner.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);
    expect(detail.body.data.id).toBe(learner.userId);
    expect(detail.body.data.role).toBe(Role.USER);

    const missing = await request(app.getHttpServer())
      .get('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.NOT_FOUND);
    expect(missing.body.error.code).toBe(ErrorCode.NOT_FOUND);

    const promote = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${learner.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.ADMIN })
      .expect(HttpStatus.OK);
    expect(promote.body.data.role).toBe(Role.ADMIN);
    expect(promote.body.data.updatedBy).toBe(actingAdminId);
    const promotedUpdatedAt = promote.body.data.updatedAt as string;

    const noop = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${learner.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.ADMIN })
      .expect(HttpStatus.OK);
    expect(noop.body.data.updatedAt).toBe(promotedUpdatedAt);
    expect(noop.body.data.updatedBy).toBe(actingAdminId);

    const demote = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${learner.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.USER })
      .expect(HttpStatus.OK);
    expect(demote.body.data.role).toBe(Role.USER);

    // Leave only one admin among our fixtures by demoting otherAdmin via SQL-safe path:
    // demote otherAdmin so primary is sole remaining admin among test users that we control —
    // but seed admins may also exist. Demote primary while ensuring at least one admin remains
    // in the whole DB by using otherAdmin as survivor, then try demoting survivor.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${otherAdmin.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: Role.USER })
      .expect(HttpStatus.OK);

    const adminCount = await platformDataSource.query<{ count: string }[]>(
      `SELECT COUNT(*)::text AS count FROM users WHERE role = $1`,
      [Role.ADMIN],
    );
    const count = Number(adminCount[0]?.count ?? 0);

    if (count === 1) {
      const sole = await platformDataSource.query<{ id: string }[]>(
        `SELECT id FROM users WHERE role = $1 LIMIT 1`,
        [Role.ADMIN],
      );
      const soleId = sole[0].id;
      const lastAdmin = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${soleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.USER })
        .expect(HttpStatus.CONFLICT);
      expect(lastAdmin.body.error.code).toBe(ErrorCode.CONFLICT);
      expect(lastAdmin.body.error.message).toContain('last remaining admin');
    } else {
      // Ensure last-admin path by temporarily demoting all other admins in a transaction-like
      // SQL setup for this test only, then restore.
      const others = await platformDataSource.query<{ id: string }[]>(
        `SELECT id FROM users WHERE role = $1 AND id <> $2`,
        [Role.ADMIN, actingAdminId],
      );
      for (const row of others) {
        await platformDataSource.query(
          `UPDATE users SET role = $1 WHERE id = $2`,
          [Role.USER, row.id],
        );
      }

      const lastAdmin = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${actingAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.USER })
        .expect(HttpStatus.CONFLICT);
      expect(lastAdmin.body.error.code).toBe(ErrorCode.CONFLICT);

      for (const row of others) {
        await platformDataSource.query(
          `UPDATE users SET role = $1 WHERE id = $2`,
          [Role.ADMIN, row.id],
        );
      }
    }
  });
});
