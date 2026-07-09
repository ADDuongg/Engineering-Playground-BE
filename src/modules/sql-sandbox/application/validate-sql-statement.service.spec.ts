import { ValidateSqlStatementService } from './validate-sql-statement.service';
import { DomainError } from '../../../common/errors/domain.error';
import {
  ErrorCode,
  SandboxViolationCode,
  SqlStatementKind,
} from '@db-play/types';
import { DEFAULT_SANDBOX_CONFIG } from '../config/sandbox.config';

describe('ValidateSqlStatementService', () => {
  let service: ValidateSqlStatementService;

  beforeEach(() => {
    service = new ValidateSqlStatementService(DEFAULT_SANDBOX_CONFIG);
  });

  it('validates allowed SELECT', () => {
    const result = service.validate('SELECT $1::int AS n', [1]);
    expect(result.statementKind).toBe(SqlStatementKind.SELECT);
    expect(result.valid).toBe(true);
  });

  it('validates EXPLAIN ANALYZE', () => {
    const result = service.validate('EXPLAIN ANALYZE SELECT 1', []);
    expect(result.statementKind).toBe(SqlStatementKind.EXPLAIN_ANALYZE);
  });

  it('validates CREATE INDEX', () => {
    const result = service.validate(
      'CREATE INDEX idx_test ON users (email)',
      [],
    );
    expect(result.statementKind).toBe(SqlStatementKind.CREATE_INDEX);
  });

  it('validates Index Playground recommended CREATE INDEX DDL', () => {
    const result = service.validate(
      'CREATE INDEX idx_users_email ON users (email)',
      [],
    );
    expect(result.statementKind).toBe(SqlStatementKind.CREATE_INDEX);
    expect(result.valid).toBe(true);
  });

  it('validates DROP INDEX', () => {
    const result = service.validate('DROP INDEX idx_test', []);
    expect(result.statementKind).toBe(SqlStatementKind.DROP_INDEX);
  });

  it('validates Index Playground recommended DROP INDEX DDL', () => {
    const result = service.validate('DROP INDEX idx_users_email', []);
    expect(result.statementKind).toBe(SqlStatementKind.DROP_INDEX);
    expect(result.valid).toBe(true);
  });

  it('rejects empty SQL', () => {
    expect(() => service.validate('   ', [])).toThrow(DomainError);
    try {
      service.validate('   ', []);
    } catch (error) {
      const domainError = error as DomainError;
      expect(domainError.code).toBe(ErrorCode.SANDBOX_ERROR);
      expect(
        (domainError.details as { violationCode: SandboxViolationCode })
          .violationCode,
      ).toBe(SandboxViolationCode.EMPTY_SQL);
    }
  });

  it('rejects DROP DATABASE via blocked pattern', () => {
    expect(() => service.validate('DROP DATABASE playground_db', [])).toThrow(
      DomainError,
    );
  });

  it('rejects COPY PROGRAM via blocked pattern', () => {
    expect(() =>
      service.validate("COPY (SELECT 1) TO PROGRAM 'id'", []),
    ).toThrow(DomainError);
  });

  it('rejects string concatenation patterns', () => {
    expect(() =>
      service.validate("SELECT * FROM users WHERE email = '' || $1", ['a']),
    ).toThrow(DomainError);
  });

  it('rejects missing parameters for placeholders', () => {
    expect(() => service.validate('SELECT $1, $2', [1])).toThrow(DomainError);
  });

  it('rejects multi-statement SQL', () => {
    expect(() => service.validate('SELECT 1; SELECT 2', [])).toThrow(
      DomainError,
    );
  });

  it('rejects disallowed INSERT', () => {
    expect(() =>
      service.validate('INSERT INTO users (email) VALUES ($1)', ['a@b.com']),
    ).toThrow(DomainError);
  });
});
