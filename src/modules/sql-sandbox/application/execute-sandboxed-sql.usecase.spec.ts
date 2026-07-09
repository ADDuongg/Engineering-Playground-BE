import { ExecuteSandboxedSqlUseCase } from './execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from './validate-sql-statement.service';
import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';
import { DomainError } from '../../../common/errors/domain.error';
import {
  ErrorCode,
  SandboxViolationCode,
  SqlStatementKind,
} from '@db-play/types';
import { DEFAULT_SANDBOX_CONFIG } from '../config/sandbox.config';

describe('ExecuteSandboxedSqlUseCase', () => {
  let useCase: ExecuteSandboxedSqlUseCase;
  let validateSql: jest.Mocked<ValidateSqlStatementService>;
  let playgroundDb: jest.Mocked<PlaygroundDatabaseService>;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    query: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
  };

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    validateSql = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<ValidateSqlStatementService>;

    playgroundDb = {
      getDataSource: jest.fn().mockReturnValue({
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      }),
      withSchemaScopeOnRunner: jest.fn(
        async (_queryRunner, _schemaName, run) => run(queryRunner.query.bind(queryRunner)),
      ),
    } as unknown as jest.Mocked<PlaygroundDatabaseService>;

    useCase = new ExecuteSandboxedSqlUseCase(
      validateSql,
      playgroundDb,
      DEFAULT_SANDBOX_CONFIG,
    );
  });

  it('executes allowed SELECT and returns rows', async () => {
    validateSql.validate.mockReturnValue({
      valid: true,
      normalizedSql: 'SELECT $1::int AS n',
      statementKind: SqlStatementKind.SELECT,
    });
    queryRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ n: 1 }]);

    const result = await useCase.execute({
      sql: 'SELECT $1::int AS n',
      parameters: [1],
    });

    expect(result.rows).toEqual([{ n: 1 }]);
    expect(result.rowCount).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `SET LOCAL statement_timeout = '${DEFAULT_SANDBOX_CONFIG.queryTimeoutMs}ms'`,
    );
  });

  it('truncates result rows that exceed the configured row cap', async () => {
    const cappedUseCase = new ExecuteSandboxedSqlUseCase(validateSql, playgroundDb, {
      ...DEFAULT_SANDBOX_CONFIG,
      maxRows: 2,
    });
    validateSql.validate.mockReturnValue({
      valid: true,
      normalizedSql: 'SELECT * FROM users',
      statementKind: SqlStatementKind.SELECT,
    });
    queryRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const result = await cappedUseCase.execute({
      sql: 'SELECT * FROM users',
      parameters: [],
    });

    expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it('propagates sandbox validation errors', async () => {
    validateSql.validate.mockImplementation(() => {
      throw new DomainError(
        ErrorCode.SANDBOX_ERROR,
        'blocked',
        403,
        {
          violationCode: SandboxViolationCode.BLOCKED_PATTERN,
          policyVersion: '1',
        },
      );
    });

    await expect(
      useCase.execute({ sql: 'DROP DATABASE x', parameters: [] }),
    ).rejects.toThrow(DomainError);
    expect(queryRunner.connect).not.toHaveBeenCalled();
  });

  it('maps statement timeout to TIMEOUT DomainError', async () => {
    validateSql.validate.mockReturnValue({
      valid: true,
      normalizedSql: 'SELECT pg_sleep(60)',
      statementKind: SqlStatementKind.SELECT,
    });
    queryRunner.query
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: '57014', message: 'canceling statement due to statement timeout' });

    await expect(
      useCase.execute({ sql: 'SELECT pg_sleep(60)', parameters: [] }),
    ).rejects.toMatchObject({
      code: ErrorCode.TIMEOUT,
      details: expect.objectContaining({
        violationCode: SandboxViolationCode.QUERY_TIMEOUT,
      }),
    });
  });

  it('bounds large result sets to the configured row cap and flags truncation', async () => {
    validateSql.validate.mockReturnValue({
      valid: true,
      normalizedSql: 'SELECT 1',
      statementKind: SqlStatementKind.SELECT,
    });

    const manyRows = Array.from({ length: 15_000 }, (_, i) => ({
      n: i,
    }));

    queryRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(manyRows);

    const result = await useCase.execute({ sql: 'SELECT 1', parameters: [] });

    expect(result.rowCount).toBe(DEFAULT_SANDBOX_CONFIG.maxRows);
    expect(result.rows).toHaveLength(DEFAULT_SANDBOX_CONFIG.maxRows);
    expect(result.truncated).toBe(true);
  });

  it('does not append LIMIT for SELECT without LIMIT clause', async () => {
    validateSql.validate.mockReturnValue({
      valid: true,
      normalizedSql: 'SELECT 1',
      statementKind: SqlStatementKind.SELECT,
    });
    queryRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ '?column?': 1 }]);

    await useCase.execute({ sql: 'SELECT 1', parameters: [] });

    expect(queryRunner.query).toHaveBeenCalledWith('SELECT 1', []);
  });
});
