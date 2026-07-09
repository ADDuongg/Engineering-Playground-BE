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
import { TracksModule } from '../../src/modules/tracks/tracks.module';
import { ProgressModule } from '../../src/modules/progress/progress.module';
import { QuizModule } from '../../src/modules/quiz/quiz.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { ErrorCode } from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;
const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;

const describeIfPlatform = platformConfigured ? describe : describe.skip;

describeIfPlatform('Progress Tracking (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const testEmail = `progress-test-${testRunId}@example.com`;
  const testPassword = 'password123';
  let accessToken: string;
  let userId: string;

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
        AuthModule,
        TracksModule,
        ProgressModule,
        QuizModule,
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
        displayName: 'Progress Test',
      })
      .expect(HttpStatus.CREATED);

    accessToken = registerRes.body.data.tokens.accessToken as string;
    userId = registerRes.body.data.user.id as string;
  }, 60_000);

  afterAll(async () => {
    if (platformDataSource?.isInitialized) {
      await platformDataSource.query(
        `DELETE FROM user_lab_completions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'progress-test-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'progress-test-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'progress-test-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  it('returns public learning path without completion flags', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tracks/database-sql/learning-path')
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.data.trackSlug).toBe('database-sql');
    expect(res.body.data.labs.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.labs[0].slug).toBe('index-playground');
    expect(res.body.data.labs[0]).not.toHaveProperty('completed');
  });

  it('rejects unauthenticated complete and progress reads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/progress/labs/index-playground/complete')
      .expect(HttpStatus.UNAUTHORIZED);

    await request(app.getHttpServer())
      .get('/api/v1/progress/tracks/database-sql')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('completes an ungated lab idempotently and updates progress', async () => {
    // index-playground is quiz-gated; use a lab without a quiz seed
    const ungatedLab = 'explain-analyze';

    const first = await request(app.getHttpServer())
      .post(`/api/v1/progress/labs/${ungatedLab}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(first.body.data.alreadyCompleted).toBe(false);
    expect(first.body.data.labSlug).toBe(ungatedLab);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/progress/labs/${ungatedLab}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(second.body.data.alreadyCompleted).toBe(true);
    expect(second.body.data.completedAt).toBe(first.body.data.completedAt);

    const progress = await request(app.getHttpServer())
      .get('/api/v1/progress/tracks/database-sql')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(progress.body.data.completedCount).toBeGreaterThanOrEqual(1);
    expect(progress.body.data.completedLabSlugs).toContain(ungatedLab);
    expect(
      progress.body.data.labs.find(
        (lab: { slug: string }) => lab.slug === ungatedLab,
      )?.completed,
    ).toBe(true);

    const rows = await platformDataSource.query(
      `SELECT COUNT(*)::int AS count FROM user_lab_completions WHERE user_id = $1`,
      [userId],
    );
    expect(rows[0].count).toBeGreaterThanOrEqual(1);
  });

  it('rejects self-complete for quiz-gated labs until quiz is passed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/progress/labs/index-playground/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body.error?.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('returns NOT_FOUND for unknown lab', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/progress/labs/does-not-exist/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    expect(res.body.error?.code ?? res.body.error).toBeDefined();
    expect(
      res.body.error?.code === ErrorCode.NOT_FOUND ||
        res.body.success === false,
    ).toBe(true);
  });

  it('keeps Platform completions isolated from playground schema (US4)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/progress/labs/benchmark-lab/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    const before = await platformDataSource.query(
      `SELECT COUNT(*)::int AS count FROM user_lab_completions WHERE user_id = $1`,
      [userId],
    );
    expect(before[0].count).toBeGreaterThanOrEqual(1);

    // Completions live only on Platform DB (no playground FK / shared tables).
    const platformTables = await platformDataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('labs', 'user_lab_completions')
       ORDER BY table_name`,
    );
    expect(platformTables.map((t: { table_name: string }) => t.table_name)).toEqual([
      'labs',
      'user_lab_completions',
    ]);

    if (playgroundConfigured) {
      const playgroundDs = new DataSource({
        type: 'postgres',
        host: process.env.PLAYGROUND_DB_HOST,
        port: parseInt(process.env.PLAYGROUND_DB_PORT ?? '5433', 10),
        username: process.env.PLAYGROUND_DB_USER,
        password: process.env.PLAYGROUND_DB_PASSWORD,
        database: process.env.PLAYGROUND_DB_NAME,
      });
      await playgroundDs.initialize();
      try {
        const playgroundHasProgress = await playgroundDs.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name IN ('labs', 'user_lab_completions')`,
        );
        expect(playgroundHasProgress).toHaveLength(0);
      } finally {
        await playgroundDs.destroy();
      }
    }

    const after = await platformDataSource.query(
      `SELECT COUNT(*)::int AS count FROM user_lab_completions WHERE user_id = $1`,
      [userId],
    );
    expect(after[0].count).toBe(before[0].count);

    const progress = await request(app.getHttpServer())
      .get('/api/v1/progress/tracks/database-sql')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(progress.body.data.completedLabSlugs).toContain('benchmark-lab');
  });
});
