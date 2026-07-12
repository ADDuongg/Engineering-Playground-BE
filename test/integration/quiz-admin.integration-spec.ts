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
import { QuizModule } from '../../src/modules/quiz/quiz.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { ErrorCode, Role, TrackStatus, LabStatus } from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;

const describeIfPlatform = platformConfigured ? describe : describe.skip;

describeIfPlatform('Quiz Admin CRUD (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const userEmail = `qa-user-${testRunId}@example.com`;
  const adminEmail = `qa-admin-${testRunId}@example.com`;
  const password = 'password123';
  const trackSlug = `qa-track-${testRunId}`.slice(0, 64);
  const labSlug = `qa-lab-${testRunId}`.slice(0, 128);

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
        QuizModule,
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
        .send({ email, password, displayName: 'QA Test' })
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
        name: 'Quiz Admin Track',
        description: 'd',
        displayOrder: 50,
        status: TrackStatus.ACTIVE,
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
        title: 'Quiz Admin Lab',
        description: 'Disposable',
        sequenceOrder: 1,
        status: LabStatus.ACTIVE,
      })
      .expect(HttpStatus.CREATED);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('admin authors quiz; learner hides isCorrect; delete ungates', async () => {
    const denied = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Nope' })
      .expect(HttpStatus.FORBIDDEN);
    expect(denied.body.error.code).toBe(ErrorCode.FORBIDDEN);

    const createQuiz = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Smoke Quiz' })
      .expect(HttpStatus.CREATED);

    expect(createQuiz.body.data.title).toBe('Smoke Quiz');
    expect(createQuiz.body.data.questions).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Dup' })
      .expect(HttpStatus.CONFLICT);

    const emptySubmit = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/labs/${labSlug}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ answers: [] })
      .expect(HttpStatus.BAD_REQUEST);
    expect(emptySubmit.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);

    const q1 = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: 'What is 1+1?',
        sequenceOrder: 1,
        options: [
          { label: '2', sequenceOrder: 1, isCorrect: true },
          { label: '3', sequenceOrder: 2, isCorrect: false },
        ],
      })
      .expect(HttpStatus.CREATED);

    const q2 = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: 'What is 2+2?',
        sequenceOrder: 2,
        options: [
          { label: '4', sequenceOrder: 1, isCorrect: true },
          { label: '5', sequenceOrder: 2, isCorrect: false },
        ],
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        prompt: 'Bad',
        sequenceOrder: 3,
        options: [
          { label: 'A', sequenceOrder: 1, isCorrect: true },
          { label: 'B', sequenceOrder: 2, isCorrect: true },
        ],
      })
      .expect(HttpStatus.BAD_REQUEST);

    const questionIds = [q2.body.data.id, q1.body.data.id];
    const reordered = await request(app.getHttpServer())
      .post(`/api/v1/admin/labs/${labSlug}/quiz/questions/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionIds })
      .expect(HttpStatus.OK);

    expect(reordered.body.data.questions.map((q: { id: string }) => q.id)).toEqual(
      questionIds,
    );

    const adminGet = await request(app.getHttpServer())
      .get(`/api/v1/admin/labs/${labSlug}/quiz`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);

    expect(
      adminGet.body.data.questions[0].options.some(
        (o: { isCorrect: boolean }) => o.isCorrect,
      ),
    ).toBe(true);

    const learnerDef = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/labs/${labSlug}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(HttpStatus.OK);

    for (const question of learnerDef.body.data.questions) {
      for (const option of question.options) {
        expect(option).not.toHaveProperty('isCorrect');
      }
    }

    const pass = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/labs/${labSlug}/submit`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        answers: learnerDef.body.data.questions.map(
          (question: {
            id: string;
            options: Array<{ id: string; label: string }>;
          }) => {
            const adminQuestion = adminGet.body.data.questions.find(
              (q: { id: string }) => q.id === question.id,
            );
            const correct = adminQuestion.options.find(
              (o: { isCorrect: boolean }) => o.isCorrect,
            );
            return { questionId: question.id, optionId: correct.id };
          },
        ),
      })
      .expect(HttpStatus.OK);

    expect(pass.body.data.passed).toBe(true);
    expect(pass.body.data.labCompleted).toBe(true);

    const completionBefore = await platformDataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM user_lab_completions ulc
       INNER JOIN labs l ON l.id = ulc.lab_id
       INNER JOIN users u ON u.id = ulc.user_id
       WHERE l.slug = $1 AND u.email = $2`,
      [labSlug, userEmail],
    );
    expect(completionBefore[0].count).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/labs/${labSlug}/quiz`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.NO_CONTENT);

    await request(app.getHttpServer())
      .get(`/api/v1/quizzes/labs/${labSlug}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(HttpStatus.NOT_FOUND);

    const completionAfter = await platformDataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM user_lab_completions ulc
       INNER JOIN labs l ON l.id = ulc.lab_id
       INNER JOIN users u ON u.id = ulc.user_id
       WHERE l.slug = $1 AND u.email = $2`,
      [labSlug, userEmail],
    );
    expect(completionAfter[0].count).toBe(1);

    // Self-complete is allowed again (lab no longer quiz-gated); already completed → idempotent OK
    await request(app.getHttpServer())
      .post(`/api/v1/progress/labs/${labSlug}/complete`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(HttpStatus.OK);
  });
});
