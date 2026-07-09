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

const describeIfPlatform = platformConfigured ? describe : describe.skip;

/** Seeded correct option ids from CreateQuizTablesAndSeed migration */
const CORRECT_ANSWERS = [
  {
    questionId: 'a1000000-0000-4000-8000-000000000011',
    optionId: 'a1000000-0000-4000-8000-000000000021',
  },
  {
    questionId: 'a1000000-0000-4000-8000-000000000012',
    optionId: 'a1000000-0000-4000-8000-000000000031',
  },
];

const WRONG_ANSWERS = [
  {
    questionId: 'a1000000-0000-4000-8000-000000000011',
    optionId: 'a1000000-0000-4000-8000-000000000022',
  },
  {
    questionId: 'a1000000-0000-4000-8000-000000000012',
    optionId: 'a1000000-0000-4000-8000-000000000032',
  },
];

describeIfPlatform('Quiz Engine (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const testEmail = `quiz-test-${testRunId}@example.com`;
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
        displayName: 'Quiz Test',
      })
      .expect(HttpStatus.CREATED);

    accessToken = registerRes.body.data.tokens.accessToken as string;
    userId = registerRes.body.data.user.id as string;
  }, 60_000);

  afterAll(async () => {
    if (platformDataSource?.isInitialized) {
      await platformDataSource.query(
        `DELETE FROM quiz_attempts WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'quiz-test-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM user_lab_completions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'quiz-test-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'quiz-test-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'quiz-test-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  it('rejects unauthenticated quiz routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/quizzes/labs/index-playground')
      .expect(HttpStatus.UNAUTHORIZED);

    await request(app.getHttpServer())
      .post('/api/v1/quizzes/labs/index-playground/submit')
      .send({ answers: CORRECT_ANSWERS })
      .expect(HttpStatus.UNAUTHORIZED);

    await request(app.getHttpServer())
      .get('/api/v1/quizzes/labs/index-playground/result')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns quiz definition without isCorrect', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/quizzes/labs/index-playground')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.data.questions.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(res.body.data)).not.toContain('isCorrect');
    expect(res.body.data.questions[0].options[0]).toHaveProperty('id');
    expect(res.body.data.questions[0].options[0]).toHaveProperty('label');
  });

  it('blocks self-complete until quiz pass, then completes on pass', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/progress/labs/index-playground/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    const fail = await request(app.getHttpServer())
      .post('/api/v1/quizzes/labs/index-playground/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: WRONG_ANSWERS })
      .expect(HttpStatus.OK);

    expect(fail.body.data.passed).toBe(false);
    expect(fail.body.data.labCompleted).toBe(false);

    await request(app.getHttpServer())
      .post('/api/v1/progress/labs/index-playground/complete')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    const pass = await request(app.getHttpServer())
      .post('/api/v1/quizzes/labs/index-playground/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: CORRECT_ANSWERS })
      .expect(HttpStatus.OK);

    expect(pass.body.data.passed).toBe(true);
    expect(pass.body.data.percentCorrect).toBe(100);
    expect(pass.body.data.labCompleted).toBe(true);

    const progress = await request(app.getHttpServer())
      .get('/api/v1/progress/tracks/database-sql')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(progress.body.data.completedLabSlugs).toContain('index-playground');

    const result = await request(app.getHttpServer())
      .get('/api/v1/quizzes/labs/index-playground/result')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(result.body.data.status).toBe('passed');
    expect(result.body.data.percentCorrect).toBe(100);
    expect(result.body.data.attemptCount).toBeGreaterThanOrEqual(2);

    const attempts = await platformDataSource.query(
      `SELECT COUNT(*)::int AS count FROM quiz_attempts WHERE user_id = $1`,
      [userId],
    );
    expect(attempts[0].count).toBeGreaterThanOrEqual(2);
  });

  it('keeps quiz attempts on Platform DB (not playground)', async () => {
    const tables = await platformDataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('quizzes', 'quiz_attempts')
       ORDER BY table_name`,
    );
    expect(tables.map((t: { table_name: string }) => t.table_name)).toEqual([
      'quiz_attempts',
      'quizzes',
    ]);
  });
});
