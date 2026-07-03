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
});
