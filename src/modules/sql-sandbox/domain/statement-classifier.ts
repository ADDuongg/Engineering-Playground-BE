import { parse, parseFirst, Statement } from 'pgsql-ast-parser';
import { SqlStatementKind } from '@db-play/types';

export interface ClassifiedStatement {
  statementKind: SqlStatementKind;
  /** SQL passed to the parser (EXPLAIN prefix stripped when applicable). */
  parseTarget: string;
  /** Original normalized SQL for execution. */
  normalizedSql: string;
}

export function normalizeSql(sql: string): string {
  return sql.trim().replace(/;\s*$/, '');
}

export function classifyStatement(sql: string): ClassifiedStatement {
  const normalizedSql = normalizeSql(sql);

  if (!normalizedSql) {
    throw new Error('EMPTY_SQL');
  }

  if (hasMultipleStatements(normalizedSql)) {
    throw new Error('MULTI_STATEMENT');
  }

  const explainParsed = parseExplainPrefix(normalizedSql);
  if (explainParsed) {
    assertParsable(explainParsed.inner);
    return {
      statementKind: explainParsed.isAnalyze
        ? SqlStatementKind.EXPLAIN_ANALYZE
        : SqlStatementKind.EXPLAIN,
      parseTarget: explainParsed.inner,
      normalizedSql,
    };
  }

  const ast = parseFirst(normalizedSql);
  const statementKind = mapAstToKind(ast);
  return {
    statementKind,
    parseTarget: normalizedSql,
    normalizedSql,
  };
}

function hasMultipleStatements(sql: string): boolean {
  try {
    return parse(sql).length > 1;
  } catch {
    return /;\s*\S/.test(sql);
  }
}

function assertParsable(sql: string): void {
  parseFirst(sql);
}

function parseExplainPrefix(
  normalizedSql: string,
): { isAnalyze: boolean; inner: string } | null {
  if (!/^\s*EXPLAIN\b/i.test(normalizedSql)) {
    return null;
  }

  const withOptions = normalizedSql.match(
    /^\s*EXPLAIN\s+\(([^)]*)\)\s*(.+)$/is,
  );
  if (withOptions) {
    return {
      isAnalyze: /\bANALYZE\b/i.test(withOptions[1]),
      inner: withOptions[2].trim(),
    };
  }

  const analyzeDirect = normalizedSql.match(/^\s*EXPLAIN\s+ANALYZE\s+(.+)$/is);
  if (analyzeDirect) {
    return {
      isAnalyze: true,
      inner: analyzeDirect[1].trim(),
    };
  }

  const plainExplain = normalizedSql.match(/^\s*EXPLAIN\s+(.+)$/is);
  if (plainExplain) {
    return {
      isAnalyze: false,
      inner: plainExplain[1].trim(),
    };
  }

  return null;
}

function mapAstToKind(ast: Statement): SqlStatementKind {
  switch (ast.type) {
    case 'select':
      return SqlStatementKind.SELECT;
    case 'create index':
      return SqlStatementKind.CREATE_INDEX;
    case 'drop index':
      return SqlStatementKind.DROP_INDEX;
    default:
      throw new Error(`DISALLOWED:${ast.type}`);
  }
}

export function isAllowedStatementKind(
  kind: SqlStatementKind,
  allowed: SqlStatementKind[],
): boolean {
  return allowed.includes(kind);
}
