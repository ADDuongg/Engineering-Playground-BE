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
import { PlaygroundDatabaseModule } from '../../src/database/playground/playground-database.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { TracksModule } from '../../src/modules/tracks/tracks.module';
import { ProgressModule } from '../../src/modules/progress/progress.module';
import { QuizModule } from '../../src/modules/quiz/quiz.module';
import { LabsModule } from '../../src/modules/labs/labs.module';
import { DatasetLoaderModule } from '../../src/modules/dataset-loader/dataset-loader.module';
import { SqlSandboxModule } from '../../src/modules/sql-sandbox/sql-sandbox.module';
import { ExperimentRunnerModule } from '../../src/modules/experiment-runner/experiment-runner.module';
import { ExplainRunnerModule } from '../../src/modules/explain-runner/explain-runner.module';
import { MetricsPipelineModule } from '../../src/modules/metrics-pipeline/metrics-pipeline.module';
import { RedisModule } from '../../src/common/services/redis.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../../src/common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { PrepareDatasetUseCase } from '../../src/modules/dataset-loader/application/prepare-dataset.usecase';
import { RunExperimentSqlUseCase } from '../../src/modules/experiment-runner/application/run-experiment-sql.usecase';
import { RunExplainUseCase } from '../../src/modules/explain-runner/application/run-explain.usecase';
import { INDEX_PLAYGROUND_CONTENT } from '../../src/modules/labs/infrastructure/lab-summary.content';
import {
  DatasetTier,
  ErrorCode,
  ExplainMode,
} from '@db-play/types';

const platformConfigured =
  process.env.PLATFORM_DB_HOST && process.env.PLATFORM_DB_USER;
const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;
const redisConfigured = process.env.REDIS_HOST;

const describeIfPlatform = platformConfigured ? describe : describe.skip;
const describeIfFullStack =
  platformConfigured && playgroundConfigured && redisConfigured
    ? describe
    : describe.skip;

describeIfPlatform('Index Playground — lab summary (integration)', () => {
  let app: INestApplication<App>;
  let moduleRef: TestingModule;
  let platformDataSource: DataSource;

  const testRunId = `${Date.now()}`;
  const testEmail = `index-lab-${testRunId}@example.com`;
  const testPassword = 'password123';
  let accessToken: string;

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
        LabsModule,
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
        displayName: 'Index Lab Test',
      })
      .expect(HttpStatus.CREATED);

    accessToken = registerRes.body.data.tokens.accessToken as string;
  }, 60_000);

  afterAll(async () => {
    if (platformDataSource?.isInitialized) {
      await platformDataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'index-lab-%@example.com')`,
      );
      await platformDataSource.query(
        `DELETE FROM users WHERE email LIKE 'index-lab-%@example.com'`,
      );
    }
    await app?.close();
    await moduleRef?.close();
  });

  it('rejects unauthenticated summary', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/labs/index-playground/summary')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns Index Playground summary with quizRequired', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/labs/index-playground/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.labSlug).toBe('index-playground');
    expect(data.quizRequired).toBe(true);
    expect(data.guidedSteps.length).toBeGreaterThanOrEqual(3);
    expect(data.recommendedQuery.sql).toContain('users');
    expect(data.recommendedCreateIndexSql).toMatch(/users\s*\(\s*email\s*\)/i);
  });

  it('returns 404 for unknown lab summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/labs/not-a-real-lab/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    expect(res.body.error?.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('still returns quiz definition for index-playground (US6)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/quizzes/labs/index-playground')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);

    expect(res.body.data.questions.length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Full before/after SQL + explain loop (T010/T012).
 * Skipped unless playground + redis + platform are configured.
 * Marked slow — may take minutes for dataset prepare on cold env.
 */
describeIfFullStack('Index Playground — SQL/explain loop (slow)', () => {
  let moduleRef: TestingModule;
  let prepareDataset: PrepareDatasetUseCase;
  let runExperimentSql: RunExperimentSqlUseCase;
  let runExplain: RunExplainUseCase;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        PlatformDatabaseModule,
        PlaygroundDatabaseModule,
        RedisModule,
        DatasetLoaderModule,
        SqlSandboxModule,
        ExperimentRunnerModule,
        ExplainRunnerModule,
        MetricsPipelineModule,
      ],
    }).compile();

    prepareDataset = moduleRef.get(PrepareDatasetUseCase);
    runExperimentSql = moduleRef.get(RunExperimentSqlUseCase);
    runExplain = moduleRef.get(RunExplainUseCase);
  }, 60_000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it(
    'create index then explain shows index scan metrics direction',
    async () => {
      const dataset = {
        family: 'commerce',
        version: 'v1',
        tier: DatasetTier.TIER_100K,
      };
      const labContext = {
        trackSlug: 'database-sql',
        labSlug: 'index-playground',
        userId: 'index-playground-integration',
        preAuthorized: true,
      };

      await prepareDataset.execute({
        ...dataset,
        context: {
          ...labContext,
          requestId: `idx-prep-${Date.now()}`,
        },
      });

      // Ensure clean index state
      try {
        await runExperimentSql.execute({
          sql: INDEX_PLAYGROUND_CONTENT.recommendedDropIndexSql,
          parameters: [],
          dataset,
          context: {
            ...labContext,
            requestId: `idx-drop-${Date.now()}`,
          },
        });
      } catch {
        // index may not exist yet
      }

      const guidedParams =
        INDEX_PLAYGROUND_CONTENT.recommendedQuery.exampleParameters;

      const beforeExplain = await runExplain.execute({
        sql: INDEX_PLAYGROUND_CONTENT.recommendedQuery.sql,
        parameters: guidedParams,
        explainMode: ExplainMode.EXPLAIN_ANALYZE,
        dataset,
        context: {
          trackSlug: labContext.trackSlug,
          labSlug: labContext.labSlug,
          userId: labContext.userId,
          requestId: `idx-explain-before-${Date.now()}`,
        },
      });

      const beforeSeq = beforeExplain.metrics?.find(
        (m) => m.key === 'seq_scan_used',
      )?.value;
      const beforeRows = beforeExplain.metrics?.find(
        (m) => m.key === 'rows_scanned',
      )?.value;

      expect(beforeExplain.metrics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'rows_scanned' }),
          expect.objectContaining({ key: 'seq_scan_used' }),
          expect.objectContaining({ key: 'index_scan_used' }),
        ]),
      );

      await runExperimentSql.execute({
        sql: INDEX_PLAYGROUND_CONTENT.recommendedCreateIndexSql,
        parameters: [],
        dataset,
        context: {
          ...labContext,
          requestId: `idx-create-${Date.now()}`,
        },
      });

      await runExperimentSql.execute({
        sql: INDEX_PLAYGROUND_CONTENT.recommendedQuery.sql,
        parameters: guidedParams,
        dataset,
        context: {
          ...labContext,
          requestId: `idx-select-${Date.now()}`,
        },
      });

      const afterExplain = await runExplain.execute({
        sql: INDEX_PLAYGROUND_CONTENT.recommendedQuery.sql,
        parameters: guidedParams,
        explainMode: ExplainMode.EXPLAIN_ANALYZE,
        dataset,
        context: {
          trackSlug: labContext.trackSlug,
          labSlug: labContext.labSlug,
          userId: labContext.userId,
          requestId: `idx-explain-after-${Date.now()}`,
        },
      });

      const afterIndex = afterExplain.metrics?.find(
        (m) => m.key === 'index_scan_used',
      )?.value;
      const afterRows = afterExplain.metrics?.find(
        (m) => m.key === 'rows_scanned',
      )?.value;

      expect(afterIndex).toBe(1);
      if (typeof beforeRows === 'number' && typeof afterRows === 'number') {
        expect(afterRows).toBeLessThan(beforeRows);
      }
      if (typeof beforeSeq === 'number') {
        expect(beforeSeq).toBe(1);
      }
    },
    300_000,
  );
});
