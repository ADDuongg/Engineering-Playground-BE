import { loadMonorepoEnv } from '../../src/config/load-env';

loadMonorepoEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '../../src/config/configuration';
import { envValidationSchema } from '../../src/config/env.validation';
import { SqlSandboxModule } from '../../src/modules/sql-sandbox/sql-sandbox.module';
import { ExecuteSandboxedSqlUseCase } from '../../src/modules/sql-sandbox/application/execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from '../../src/modules/sql-sandbox/application/validate-sql-statement.service';
import { DomainError } from '../../src/common/errors/domain.error';
import { ErrorCode, SandboxViolationCode } from '@db-play/types';

const playgroundConfigured =
  process.env.PLAYGROUND_DB_HOST && process.env.PLAYGROUND_DB_USER;

const describeIfPlayground = playgroundConfigured ? describe : describe.skip;

describeIfPlayground('SQL Sandbox (integration)', () => {
  let moduleRef: TestingModule;
  let executeSql: ExecuteSandboxedSqlUseCase;
  let validateSql: ValidateSqlStatementService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        TypeOrmModule.forRootAsync({
          name: 'playground',
          useFactory: () => ({
            name: 'playground',
            type: 'postgres' as const,
            host: process.env.PLAYGROUND_DB_HOST,
            port: parseInt(process.env.PLAYGROUND_DB_PORT ?? '5433', 10),
            username: process.env.PLAYGROUND_DB_USER,
            password: process.env.PLAYGROUND_DB_PASSWORD,
            database: process.env.PLAYGROUND_DB_NAME,
            entities: [],
            synchronize: false,
          }),
        }),
        SqlSandboxModule,
      ],
    }).compile();

    executeSql = moduleRef.get(ExecuteSandboxedSqlUseCase);
    validateSql = moduleRef.get(ValidateSqlStatementService);
  }, 30_000);

  afterAll(async () => {
    await moduleRef.close();
  });

  it('executes SELECT against playground database', async () => {
    const result = await executeSql.execute({
      sql: 'SELECT $1::int AS n',
      parameters: [42],
    });

    expect(result.rows[0]).toEqual({ n: 42 });
    expect(result.truncated).toBe(false);
  });

  it('blocks DROP DATABASE before execution', () => {
    expect(() =>
      validateSql.validate('DROP DATABASE playground_db', []),
    ).toThrow(DomainError);

    try {
      validateSql.validate('DROP DATABASE playground_db', []);
    } catch (error) {
      const domainError = error as DomainError;
      expect(domainError.code).toBe(ErrorCode.SANDBOX_ERROR);
      expect(
        (domainError.details as { violationCode: SandboxViolationCode })
          .violationCode,
      ).toBe(SandboxViolationCode.BLOCKED_PATTERN);
    }
  });

  it('blocks COPY PROGRAM before execution', () => {
    expect(() =>
      validateSql.validate("COPY (SELECT 1) TO PROGRAM 'id'", []),
    ).toThrow(DomainError);
  });

  it(
    'times out long-running queries',
    async () => {
      const slowModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                ...configuration(),
                sandbox: {
                  queryTimeoutMs: 500,
                  policyVersion: '1',
                },
              }),
            ],
          }),
          TypeOrmModule.forRootAsync({
            name: 'playground',
            useFactory: () => ({
              name: 'playground',
              type: 'postgres' as const,
              host: process.env.PLAYGROUND_DB_HOST,
              port: parseInt(process.env.PLAYGROUND_DB_PORT ?? '5433', 10),
              username: process.env.PLAYGROUND_DB_USER,
              password: process.env.PLAYGROUND_DB_PASSWORD,
              database: process.env.PLAYGROUND_DB_NAME,
              entities: [],
              synchronize: false,
            }),
          }),
          SqlSandboxModule,
        ],
      }).compile();

      const slowExecute = slowModule.get(ExecuteSandboxedSqlUseCase);

      await expect(
        slowExecute.execute({
          sql: 'SELECT pg_sleep(5)',
          parameters: [],
        }),
      ).rejects.toMatchObject({ code: ErrorCode.TIMEOUT });

      await slowModule.close();
    },
    15_000,
  );
});
