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
import { TracksModule } from '../../src/modules/tracks/tracks.module';
import { ProgressModule } from '../../src/modules/progress/progress.module';
import { LabsModule } from '../../src/modules/labs/labs.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import {
  ErrorCode,
  LabStatus,
  Role,
  TrackStatus,
} from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfPlatform = platformConfigured ? describe : describe.skip;

describeIfPlatform('Track & Lab Admin CRUD (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const userEmail = `tla-user-${testRunId}@example.com`;
  const adminEmail = `tla-admin-${testRunId}@example.com`;
  const password = 'password123';
  const trackSlug = `demo-track-${testRunId}`.slice(0, 64);
  const labSlug = `demo-lab-${testRunId}`.slice(0, 128);

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
        TracksModule,
        ProgressModule,
        LabsModule,
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
        `DELETE FROM labs WHERE slug = $1`,
        [labSlug],
      );
      await platformDataSource.query(
        `DELETE FROM tracks WHERE slug = $1`,
        [trackSlug],
      );
      await platformDataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'tla-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'tla-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  async function registerAndLogin(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, displayName: 'TLA Test' })
      .expect(HttpStatus.CREATED);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);

    return login.body.data.tokens.accessToken as string;
  }

  async function promoteToAdmin(email: string): Promise<string> {
    await platformDataSource.query(
      `UPDATE users SET role = $1 WHERE email = $2`,
      [Role.ADMIN, email],
    );
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);
    return login.body.data.tokens.accessToken as string;
  }

  it('admin creates/updates track and lab; non-admin forbidden; learner path shows status', async () => {
    await registerAndLogin(adminEmail);
    const adminToken = await promoteToAdmin(adminEmail);
    const userToken = await registerAndLogin(userEmail);

    const denied = await request(app.getHttpServer())
      .post('/api/v1/admin/tracks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        slug: trackSlug,
        name: 'Demo',
        description: 'd',
        runtimeAdapterType: 'playground_postgresql',
        inputSurfaceType: 'sql_editor',
        metricCatalogId: 'database-metrics',
        visualizationKitId: 'database-viz',
      })
      .expect(HttpStatus.FORBIDDEN);
    expect(denied.body.error.code).toBe(ErrorCode.FORBIDDEN);

    const createTrack = await request(app.getHttpServer())
      .post('/api/v1/admin/tracks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: trackSlug,
        name: 'Demo Track',
        description: 'Admin CRUD smoke',
        displayOrder: 99,
        runtimeAdapterType: 'playground_postgresql',
        inputSurfaceType: 'sql_editor',
        metricCatalogId: 'database-metrics',
        visualizationKitId: 'database-viz',
      })
      .expect(HttpStatus.CREATED);

    expect(createTrack.body.success).toBe(true);
    expect(createTrack.body.data.status).toBe(TrackStatus.COMING_SOON);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/tracks/${trackSlug}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: TrackStatus.ACTIVE })
      .expect(HttpStatus.OK);

    const createLab = await request(app.getHttpServer())
      .post(`/api/v1/admin/tracks/${trackSlug}/labs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: labSlug,
        title: 'Demo Lab',
        description: 'Smoke lab',
        sequenceOrder: 1,
      })
      .expect(HttpStatus.CREATED);

    expect(createLab.body.data.status).toBe(LabStatus.COMING_SOON);

    const listLabs = await request(app.getHttpServer())
      .get(`/api/v1/admin/tracks/${trackSlug}/labs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);
    expect(listLabs.body.data.labs.some((l: { slug: string }) => l.slug === labSlug)).toBe(
      true,
    );

    const path = await request(app.getHttpServer())
      .get(`/api/v1/tracks/${trackSlug}/learning-path`)
      .expect(HttpStatus.OK);
    const pathLab = path.body.data.labs.find(
      (l: { slug: string }) => l.slug === labSlug,
    );
    expect(pathLab).toBeDefined();
    expect(pathLab.status).toBe(LabStatus.COMING_SOON);

    const summaryBlocked = await request(app.getHttpServer())
      .get(`/api/v1/labs/${labSlug}/summary`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(HttpStatus.FORBIDDEN);
    expect(summaryBlocked.body.error.code).toBe(ErrorCode.FORBIDDEN);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/labs/${labSlug}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: LabStatus.ACTIVE })
      .expect(HttpStatus.OK);

    const softHide = await request(app.getHttpServer())
      .patch(`/api/v1/admin/labs/${labSlug}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: LabStatus.COMING_SOON })
      .expect(HttpStatus.OK);
    expect(softHide.body.data.status).toBe(LabStatus.COMING_SOON);

    const seeded = await request(app.getHttpServer())
      .get('/api/v1/admin/labs/index-playground')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);
    expect(seeded.body.data.status).toBe(LabStatus.ACTIVE);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/labs/${labSlug}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns 404 for unknown admin track/lab and 409 for duplicate slug', async () => {
    await registerAndLogin(`tla-admin2-${testRunId}@example.com`);
    const adminToken = await promoteToAdmin(`tla-admin2-${testRunId}@example.com`);

    await request(app.getHttpServer())
      .get('/api/v1/admin/tracks/does-not-exist-xyz')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.NOT_FOUND);

    const dup = await request(app.getHttpServer())
      .post('/api/v1/admin/tracks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: 'database-sql',
        name: 'Dup',
        description: 'd',
        runtimeAdapterType: 'playground_postgresql',
        inputSurfaceType: 'sql_editor',
        metricCatalogId: 'database-metrics',
        visualizationKitId: 'database-viz',
      })
      .expect(HttpStatus.CONFLICT);
    expect(dup.body.error.code).toBe(ErrorCode.CONFLICT);
  });
});
