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
});
