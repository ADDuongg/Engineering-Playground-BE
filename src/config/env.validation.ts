import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('*'),

  PLATFORM_DB_HOST: Joi.string().required(),
  PLATFORM_DB_PORT: Joi.number().default(5432),
  PLATFORM_DB_USER: Joi.string().required(),
  PLATFORM_DB_PASSWORD: Joi.string().required(),
  PLATFORM_DB_NAME: Joi.string().required(),
  PLATFORM_DB_POOL_SIZE: Joi.number().default(10),

  PLAYGROUND_DB_HOST: Joi.string().required(),
  PLAYGROUND_DB_PORT: Joi.number().default(5433),
  PLAYGROUND_DB_USER: Joi.string().required(),
  PLAYGROUND_DB_PASSWORD: Joi.string().required(),
  PLAYGROUND_DB_NAME: Joi.string().required(),
  PLAYGROUND_DB_POOL_SIZE: Joi.number().default(5),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN_DAYS: Joi.number().default(7),

  SANDBOX_QUERY_TIMEOUT_MS: Joi.number().min(1000).max(120000).default(30000),
  SANDBOX_POLICY_VERSION: Joi.string().default('1'),
  SANDBOX_MAX_ROWS: Joi.number().min(1).max(100000).default(1000),

  DATASET_MANIFEST_PATH: Joi.string().default('seeds/datasets/manifest.json'),
  DATASET_SYNC_TIER_MAX: Joi.string()
    .valid('100k', '1m', '10m')
    .default('100k'),
  DATASET_PREPARATION_TTL_SECONDS: Joi.number().min(60).max(86400).default(3600),
  DATASET_PREPARATION_STALE_MS: Joi.number().min(30000).max(3600000).default(300000),
  DATASET_DEFAULT_VERSION: Joi.string().default('v1'),

  EXPERIMENT_SESSION_IDLE_TTL_SECONDS: Joi.number()
    .min(300)
    .max(86400)
    .default(3600),

  METRICS_RETENTION_LIMIT: Joi.number().min(1).max(200).default(50),

  RATE_LIMIT_WINDOW_SECONDS: Joi.number().min(10).max(3600).default(60),
  RATE_LIMIT_SQL_RUN: Joi.number().min(1).max(1000).default(30),
  RATE_LIMIT_EXPLAIN_RUN: Joi.number().min(1).max(1000).default(10),
  RATE_LIMIT_DATASET_RESET: Joi.number().min(1).max(1000).default(5),
  RATE_LIMIT_BENCHMARK_ENQUEUE: Joi.number().min(1).max(1000).default(5),
  RATE_LIMIT_ELEVATED_ENABLED: Joi.boolean().default(false),
  RATE_LIMIT_ELEVATED_USER_IDS: Joi.string().allow('').default(''),
  RATE_LIMIT_ELEVATED_MULTIPLIER: Joi.number().min(2).max(100).default(5),

  JOB_STATUS_TTL_SECONDS: Joi.number().min(300).max(604800).default(86400),

  DATASET_RESET_QUEUE_NAME: Joi.string().default('dataset-reset-jobs'),
  DATASET_RESET_WORKER_CONCURRENCY: Joi.number().min(1).max(32).default(2),
  DATASET_RESET_JOB_TIMEOUT_SECONDS: Joi.number().min(30).max(3600).default(600),
  DATASET_RESET_MAX_ATTEMPTS: Joi.number().min(1).max(10).default(3),
  DATASET_RESET_BACKOFF_DELAY_MS: Joi.number().min(100).max(60000).default(2000),

  BENCHMARK_QUEUE_NAME: Joi.string().default('benchmark-jobs'),
  BENCHMARK_WORKER_CONCURRENCY: Joi.number().min(1).max(32).default(2),
  BENCHMARK_MAX_INFLIGHT_PER_SESSION: Joi.number().min(1).max(10).default(1),
  BENCHMARK_JOB_TTL_SECONDS: Joi.number().min(300).max(604800).default(86400),
  BENCHMARK_K6_BINARY: Joi.string().default('k6'),
  BENCHMARK_INTERNAL_BASE_URL: Joi.string().uri().optional(),
  BENCHMARK_INTERNAL_SECRET: Joi.string().min(16).default('benchmark-internal-dev'),
  BENCHMARK_ALLOWED_RPS: Joi.string().default('100,500,1000,5000'),
  BENCHMARK_ALLOWED_DURATION_SECONDS: Joi.string().default('10,30,60'),
  BENCHMARK_JOB_TIMEOUT_SECONDS: Joi.number().min(10).max(600).default(120),
  BENCHMARK_MAX_ATTEMPTS: Joi.number().min(1).max(10).default(2),
  BENCHMARK_BACKOFF_DELAY_MS: Joi.number().min(100).max(60000).default(2000),
  BENCHMARK_PROGRESS_INTERVAL_MS: Joi.number().min(200).max(10000).default(1000),
  BENCHMARK_PROGRESS_TTL_SECONDS: Joi.number().min(60).max(604800).default(86400),

  SQL_EXECUTION_QUEUE_NAME: Joi.string().default('sql-execution-jobs'),
  SQL_EXECUTION_WORKER_CONCURRENCY: Joi.number().min(1).max(64).default(5),
  SQL_EXECUTION_JOB_TIMEOUT_SECONDS: Joi.number().min(5).max(600).default(60),
  SQL_EXECUTION_MAX_ATTEMPTS: Joi.number().min(1).max(10).default(2),
  SQL_EXECUTION_BACKOFF_MS: Joi.number().min(100).max(60000).default(1000),
  SQL_EXECUTION_MAX_INFLIGHT_PER_SESSION: Joi.number().min(1).max(10).default(1),
});
