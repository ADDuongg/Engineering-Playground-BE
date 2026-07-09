export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },
  platformDatabase: {
    host: process.env.PLATFORM_DB_HOST ?? 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT ?? '5432', 10),
    username: process.env.PLATFORM_DB_USER ?? 'platform',
    password: process.env.PLATFORM_DB_PASSWORD ?? 'platform_secret',
    database: process.env.PLATFORM_DB_NAME ?? 'platform_db',
    poolSize: parseInt(process.env.PLATFORM_DB_POOL_SIZE ?? '10', 10),
  },
  playgroundDatabase: {
    host: process.env.PLAYGROUND_DB_HOST ?? 'localhost',
    port: parseInt(process.env.PLAYGROUND_DB_PORT ?? '5433', 10),
    username: process.env.PLAYGROUND_DB_USER ?? 'playground',
    password: process.env.PLAYGROUND_DB_PASSWORD ?? 'playground_secret',
    database: process.env.PLAYGROUND_DB_NAME ?? 'playground_db',
    poolSize: parseInt(process.env.PLAYGROUND_DB_POOL_SIZE ?? '5', 10),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    refreshExpiresInDays: parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7',
      10,
    ),
  },
  sandbox: {
    queryTimeoutMs: parseInt(
      process.env.SANDBOX_QUERY_TIMEOUT_MS ?? '30000',
      10,
    ),
    policyVersion: process.env.SANDBOX_POLICY_VERSION ?? '1',
    maxRows: parseInt(process.env.SANDBOX_MAX_ROWS ?? '1000', 10),
  },
  dataset: {
    manifestPath:
      process.env.DATASET_MANIFEST_PATH ?? 'seeds/datasets/manifest.json',
    syncTierMax: process.env.DATASET_SYNC_TIER_MAX ?? '100k',
    preparationTtlSeconds: parseInt(
      process.env.DATASET_PREPARATION_TTL_SECONDS ?? '3600',
      10,
    ),
    preparationStaleMs: parseInt(
      process.env.DATASET_PREPARATION_STALE_MS ?? '300000',
      10,
    ),
    defaultVersion: process.env.DATASET_DEFAULT_VERSION ?? 'v1',
  },
  experiment: {
    sessionIdleTtlSeconds: parseInt(
      process.env.EXPERIMENT_SESSION_IDLE_TTL_SECONDS ?? '3600',
      10,
    ),
  },
  metrics: {
    retentionLimit: parseInt(
      process.env.METRICS_RETENTION_LIMIT ?? '50',
      10,
    ),
  },
  rateLimit: {
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? '60', 10),
    sqlRun: parseInt(process.env.RATE_LIMIT_SQL_RUN ?? '30', 10),
    explainRun: parseInt(process.env.RATE_LIMIT_EXPLAIN_RUN ?? '10', 10),
    datasetReset: parseInt(process.env.RATE_LIMIT_DATASET_RESET ?? '5', 10),
    benchmarkEnqueue: parseInt(
      process.env.RATE_LIMIT_BENCHMARK_ENQUEUE ?? '5',
      10,
    ),
    elevatedEnabled: process.env.RATE_LIMIT_ELEVATED_ENABLED === 'true',
    elevatedUserIds: (process.env.RATE_LIMIT_ELEVATED_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    elevatedMultiplier: parseInt(
      process.env.RATE_LIMIT_ELEVATED_MULTIPLIER ?? '5',
      10,
    ),
  },
  jobs: {
    statusTtlSeconds: parseInt(
      process.env.JOB_STATUS_TTL_SECONDS ?? '86400',
      10,
    ),
  },
  datasetReset: {
    queueName: process.env.DATASET_RESET_QUEUE_NAME ?? 'dataset-reset-jobs',
    workerConcurrency: parseInt(
      process.env.DATASET_RESET_WORKER_CONCURRENCY ?? '2',
      10,
    ),
    jobTimeoutSeconds: parseInt(
      process.env.DATASET_RESET_JOB_TIMEOUT_SECONDS ?? '600',
      10,
    ),
    maxAttempts: parseInt(process.env.DATASET_RESET_MAX_ATTEMPTS ?? '3', 10),
    backoffDelayMs: parseInt(
      process.env.DATASET_RESET_BACKOFF_DELAY_MS ?? '2000',
      10,
    ),
  },
  benchmark: {
    queueName: process.env.BENCHMARK_QUEUE_NAME ?? 'benchmark-jobs',
    workerConcurrency: parseInt(
      process.env.BENCHMARK_WORKER_CONCURRENCY ?? '2',
      10,
    ),
    maxInflightPerSession: parseInt(
      process.env.BENCHMARK_MAX_INFLIGHT_PER_SESSION ?? '1',
      10,
    ),
    jobTtlSeconds: parseInt(
      process.env.BENCHMARK_JOB_TTL_SECONDS ?? '86400',
      10,
    ),
    k6Binary: process.env.BENCHMARK_K6_BINARY ?? 'k6',
    internalBaseUrl:
      process.env.BENCHMARK_INTERNAL_BASE_URL ??
      `http://localhost:${parseInt(process.env.PORT ?? '3000', 10)}`,
    internalSecret:
      process.env.BENCHMARK_INTERNAL_SECRET ?? 'benchmark-internal-dev',
    allowedRps: (process.env.BENCHMARK_ALLOWED_RPS ?? '100,500,1000,5000')
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((n) => !Number.isNaN(n)),
    allowedDurationSeconds: (
      process.env.BENCHMARK_ALLOWED_DURATION_SECONDS ?? '10,30,60'
    )
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((n) => !Number.isNaN(n)),
    jobTimeoutSeconds: parseInt(
      process.env.BENCHMARK_JOB_TIMEOUT_SECONDS ?? '120',
      10,
    ),
    maxAttempts: parseInt(process.env.BENCHMARK_MAX_ATTEMPTS ?? '2', 10),
    backoffDelayMs: parseInt(
      process.env.BENCHMARK_BACKOFF_DELAY_MS ?? '2000',
      10,
    ),
    progressIntervalMs: parseInt(
      process.env.BENCHMARK_PROGRESS_INTERVAL_MS ?? '1000',
      10,
    ),
    progressTtlSeconds: parseInt(
      process.env.BENCHMARK_PROGRESS_TTL_SECONDS ?? '86400',
      10,
    ),
  },
  sqlExecution: {
    queueName: process.env.SQL_EXECUTION_QUEUE_NAME ?? 'sql-execution-jobs',
    workerConcurrency: parseInt(
      process.env.SQL_EXECUTION_WORKER_CONCURRENCY ?? '5',
      10,
    ),
    jobTimeoutSeconds: parseInt(
      process.env.SQL_EXECUTION_JOB_TIMEOUT_SECONDS ?? '60',
      10,
    ),
    maxAttempts: parseInt(process.env.SQL_EXECUTION_MAX_ATTEMPTS ?? '2', 10),
    backoffDelayMs: parseInt(
      process.env.SQL_EXECUTION_BACKOFF_MS ?? '1000',
      10,
    ),
    maxInflightPerSession: parseInt(
      process.env.SQL_EXECUTION_MAX_INFLIGHT_PER_SESSION ?? '1',
      10,
    ),
  },
});
