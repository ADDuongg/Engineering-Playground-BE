import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { PlatformDatabaseModule } from './database/platform/platform-database.module';
import { PlaygroundDatabaseModule } from './database/playground/playground-database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TracksModule } from './modules/tracks/tracks.module';
import { SqlSandboxModule } from './modules/sql-sandbox/sql-sandbox.module';
import { DatasetLoaderModule } from './modules/dataset-loader/dataset-loader.module';
import { ExperimentRunnerModule } from './modules/experiment-runner/experiment-runner.module';
import { ExplainRunnerModule } from './modules/explain-runner/explain-runner.module';
import { ExperimentIsolationModule } from './modules/experiment-isolation/experiment-isolation.module';
import { MetricsPipelineModule } from './modules/metrics-pipeline/metrics-pipeline.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { BenchmarkRunnerModule } from './modules/benchmark-runner/benchmark-runner.module';
import { WorkerQueueModule } from './modules/worker-queue/worker-queue.module';
import { ProgressModule } from './modules/progress/progress.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { LabsModule } from './modules/labs/labs.module';
import { AdminModule } from './modules/admin/admin.module';
import { RedisModule } from './common/services/redis.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '.env'),
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        customProps: (req) => ({
          requestId: req.headers['x-request-id'],
        }),
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.body.password'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    EventEmitterModule.forRoot(),
    PlatformDatabaseModule,
    PlaygroundDatabaseModule,
    HealthModule,
    RedisModule,
    RateLimitModule,
    AuthModule,
    TracksModule,
    SqlSandboxModule,
    DatasetLoaderModule,
    ExperimentRunnerModule,
    ExplainRunnerModule,
    ExperimentIsolationModule,
    MetricsPipelineModule,
    WorkerQueueModule,
    BenchmarkRunnerModule,
    ProgressModule,
    QuizModule,
    LabsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
