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
import { ErrorCode, Role } from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfPlatform = platformConfigured ? describe : describe.skip;

describeIfPlatform('Lab Flow Admin (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const userEmail = `lfa-user-${testRunId}@example.com`;
  const adminEmail = `lfa-admin-${testRunId}@example.com`;
  const password = 'password123';
  const trackSlug = `lfa-track-${testRunId}`.slice(0, 64);
  const labSlug = `lfa-lab-${testRunId}`.slice(0, 128);

  let userToken = '';
  let adminToken = '';

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

    async function registerAndLogin(email: string): Promise<string> {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password, displayName: 'LFA Test' })
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

    await registerAndLogin(adminEmail);
    adminToken = await promoteToAdmin(adminEmail);
    userToken = await registerAndLogin(userEmail);

    await request(app.getHttpServer())
      .post('/api/v1/admin/tracks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: trackSlug,
        name: 'LFA Track',
        description: 'Lab flow admin smoke track',
        status: 'active',
        displayOrder: 50,
        runtimeAdapterType: 'playground_postgresql',
        inputSurfaceType: 'sql_editor',
        metricCatalogId: 'database-metrics',
        visualizationKitId: 'database-viz',
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/tracks/${trackSlug}/labs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slug: labSlug,
        title: 'LFA Lab',
        description: 'Smoke lab',
        sequenceOrder: 1,
        status: 'active',
      })
      .expect(HttpStatus.CREATED);
  }, 90_000);

  afterAll(async () => {
    if (platformDataSource?.isInitialized) {
      await platformDataSource.query(
        `DELETE FROM lab_guided_steps WHERE lab_id IN (SELECT id FROM labs WHERE slug = $1)`,
        [labSlug],
      );
      await platformDataSource.query(
        `DELETE FROM lab_summary_curricula WHERE lab_id IN (SELECT id FROM labs WHERE slug = $1)`,
        [labSlug],
      );
      await platformDataSource.query(`DELETE FROM labs WHERE slug = $1`, [
        labSlug,
      ]);
      await platformDataSource.query(`DELETE FROM tracks WHERE slug = $1`, [
        trackSlug,
      ]);
      await platformDataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'lfa-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'lfa-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  it('seeds Index Playground curriculum + steps and serves learner summary from DB', async () => {
    const steps = await request(app.getHttpServer())
      .get('/api/v1/admin/labs/index-playground/steps')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);

    expect(steps.body.data.steps.length).toBeGreaterThanOrEqual(9);

    const summary = await request(app.getHttpServer())
      .get('/api/v1/labs/index-playground/summary')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(HttpStatus.OK);

    expect(summary.body.data.labSlug).toBe('index-playground');
    expect(summary.body.data.guidedSteps.length).toBe(
      steps.body.data.steps.length,
    );
    const runStep = summary.body.data.guidedSteps.find(
      (s: { action: string }) => s.action === 'run_sql',
    );
    expect(runStep?.payload?.recommendedQuery?.sql).toMatch(/users/i);
    const createStep = summary.body.data.guidedSteps.find(
      (s: { action: string }) => s.action === 'create_index_sql',
    );
    expect(createStep?.payload?.sql).toMatch(/CREATE INDEX/i);
    expect(summary.body.data.recommendedQuery.sql).toMatch(/users/i);
    expect(summary.body.data.learningGoal).toBeTruthy();
    expect(summary.body.data.recommendedQuery.sql).toMatch(/users/i);
  });

  it('supports step CRUD, reorder, curriculum PATCH null-clear, and AuthZ', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/curriculum`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        learningGoal: 'Learn flow',
        theory: 'Theory text',
        recommendedQuery: {
          sql: 'SELECT 1',
          exampleParameters: [],
          paramHints: [],
          description: 'noop',
        },
        recommendedCreateIndexSql: 'CREATE INDEX x ON t(a)',
        dataset: {
          family: 'commerce',
          version: 'v1',
          recommendedTier: ['100k'],
        },
        quizRequired: false,
        optionalBenchmarkNote: 'bench note',
      })
      .expect(HttpStatus.CREATED);

    expect(created.body.data.optionalBenchmarkNote).toBe('bench note');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/labs/${labSlug}/curriculum`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ optionalBenchmarkNote: null, recommendedCreateIndexSql: null })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body.data.optionalBenchmarkNote).toBeNull();
        expect(res.body.data.recommendedCreateIndexSql).toBeNull();
        expect(res.body.data.learningGoal).toBe('Learn flow');
      });

    const stepA = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Step A',
        instruction: 'Do A',
        action: 'run_sql',
        displayOrder: 1,
      })
      .expect(HttpStatus.CREATED);

    const stepB = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Step B',
        instruction: 'Do B',
        action: 'take_quiz',
        displayOrder: 2,
      })
      .expect(HttpStatus.CREATED);

    const idA = stepA.body.data.id as string;
    const idB = stepB.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/steps/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stepIds: [idB, idA] })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body.data.steps.map((s: { id: string }) => s.id)).toEqual([
          idB,
          idA,
        ]);
        expect(res.body.data.steps[0].displayOrder).toBe(1);
      });

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/labs/${labSlug}/summary`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(HttpStatus.OK);

    expect(summary.body.data.guidedSteps[0].title).toBe('Step B');
    expect(summary.body.data.guidedSteps[1].title).toBe('Step A');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/steps`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Nope',
        instruction: 'forbidden',
        action: 'run_sql',
        displayOrder: 99,
      })
      .expect(HttpStatus.FORBIDDEN)
      .expect((res) => {
        expect(res.body.error?.code).toBe(ErrorCode.FORBIDDEN);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/curriculum`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        learningGoal: 'dup',
        theory: 'dup',
        recommendedQuery: {
          sql: 'SELECT 1',
          exampleParameters: [],
          paramHints: [],
          description: 'd',
        },
        dataset: {
          family: 'commerce',
          version: 'v1',
          recommendedTier: ['100k'],
        },
        quizRequired: false,
      })
      .expect(HttpStatus.CONFLICT);
  });
});
