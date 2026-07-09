import {
  classifyStatement,
  isAllowedStatementKind,
  normalizeSql,
} from './statement-classifier';
import { findBlockedPattern } from './blocked-statement.rules';
import { SqlStatementKind } from '@db-play/types';

describe('statement-classifier', () => {
  describe('classifyStatement', () => {
    it('classifies SELECT', () => {
      const result = classifyStatement('SELECT 1 AS n');
      expect(result.statementKind).toBe(SqlStatementKind.SELECT);
    });

    it('classifies EXPLAIN SELECT', () => {
      const result = classifyStatement('EXPLAIN SELECT 1');
      expect(result.statementKind).toBe(SqlStatementKind.EXPLAIN);
    });

    it('classifies EXPLAIN ANALYZE SELECT', () => {
      const result = classifyStatement('EXPLAIN ANALYZE SELECT 1');
      expect(result.statementKind).toBe(SqlStatementKind.EXPLAIN_ANALYZE);
    });

    it('classifies EXPLAIN (ANALYZE, FORMAT JSON) SELECT', () => {
      const result = classifyStatement(
        'EXPLAIN (ANALYZE, FORMAT JSON) SELECT 1',
      );
      expect(result.statementKind).toBe(SqlStatementKind.EXPLAIN_ANALYZE);
    });

    it('classifies EXPLAIN (FORMAT JSON) SELECT', () => {
      const result = classifyStatement('EXPLAIN (FORMAT JSON) SELECT 1');
      expect(result.statementKind).toBe(SqlStatementKind.EXPLAIN);
    });

    it('classifies CREATE INDEX', () => {
      const result = classifyStatement(
        'CREATE INDEX idx_users_email ON users (email)',
      );
      expect(result.statementKind).toBe(SqlStatementKind.CREATE_INDEX);
    });

    it('classifies DROP INDEX', () => {
      const result = classifyStatement('DROP INDEX idx_users_email');
      expect(result.statementKind).toBe(SqlStatementKind.DROP_INDEX);
    });

    it('rejects INSERT', () => {
      expect(() =>
        classifyStatement('INSERT INTO users (email) VALUES ($1)'),
      ).toThrow(/DISALLOWED/);
    });

    it('rejects multi-statement input', () => {
      expect(() => classifyStatement('SELECT 1; SELECT 2')).toThrow(
        'MULTI_STATEMENT',
      );
    });

    it('strips trailing semicolon', () => {
      expect(normalizeSql('SELECT 1;')).toBe('SELECT 1');
    });
  });

  describe('isAllowedStatementKind', () => {
    it('allows configured kinds', () => {
      expect(
        isAllowedStatementKind(SqlStatementKind.SELECT, [
          SqlStatementKind.SELECT,
        ]),
      ).toBe(true);
    });
  });
});

describe('blocked-statement.rules', () => {
  it('blocks DROP DATABASE', () => {
    const match = findBlockedPattern('DROP DATABASE playground_db');
    expect(match?.message).toMatch(/DROP DATABASE/);
  });

  it('blocks COPY PROGRAM', () => {
    const match = findBlockedPattern(
      "COPY (SELECT 1) TO PROGRAM 'cat /etc/passwd'",
    );
    expect(match?.message).toMatch(/COPY/);
  });

  it('allows safe SELECT', () => {
    expect(findBlockedPattern('SELECT 1')).toBeUndefined();
  });
});
