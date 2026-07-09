import { ExplainPlanNode } from '@db-play/types';

const MAX_PLAN_NODES = 1000;

interface PgPlanNode {
  'Node Type'?: string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Filter?: string;
  'Sort Key'?: string | string[];
  'Sort Method'?: string;
  'Startup Cost'?: number;
  'Total Cost'?: number;
  'Plan Rows'?: number;
  'Plan Width'?: number;
  'Actual Rows'?: number;
  'Actual Loops'?: number;
  Plans?: PgPlanNode[];
}

interface PgExplainRoot {
  Plan?: PgPlanNode;
  'Planning Time'?: number;
  'Execution Time'?: number;
}

export interface ParsedExplainPlan {
  plan: ExplainPlanNode;
  planningTimeMs?: number;
  executionTimeMs?: number;
  truncated: boolean;
  rawPlanText?: string;
}

export class ExplainPlanParser {
  parseFromSandboxRows(rows: Record<string, unknown>[]): ParsedExplainPlan {
    const rawPlanText = this.extractRawPlanText(rows);
    const roots = this.parseJsonRoots(rawPlanText);
    const root = roots[0];

    if (!root?.Plan) {
      throw new Error('MISSING_PLAN_ROOT');
    }

    const counter = { count: 0, truncated: false };
    const plan = this.mapNode(root.Plan, counter);

    return {
      plan,
      planningTimeMs: root['Planning Time'],
      executionTimeMs: root['Execution Time'],
      truncated: counter.truncated,
      rawPlanText,
    };
  }

  private extractRawPlanText(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      throw new Error('EMPTY_EXPLAIN_RESULT');
    }

    const firstRow = rows[0];
    const planKey = Object.keys(firstRow).find(
      (key) => key.toLowerCase() === 'query plan',
    );

    if (!planKey) {
      throw new Error('MISSING_QUERY_PLAN_COLUMN');
    }

    const value = firstRow[planKey];

    if (typeof value === 'string') {
      return value;
    }

    if (value !== undefined && value !== null) {
      return JSON.stringify(value);
    }

    throw new Error('EMPTY_QUERY_PLAN_VALUE');
  }

  private parseJsonRoots(rawPlanText: string): PgExplainRoot[] {
    try {
      const parsed = JSON.parse(rawPlanText) as PgExplainRoot[] | PgExplainRoot;

      if (Array.isArray(parsed)) {
        return parsed;
      }

      return [parsed];
    } catch {
      throw new Error('INVALID_EXPLAIN_JSON');
    }
  }

  private mapNode(pgNode: PgPlanNode, counter: { count: number; truncated: boolean }): ExplainPlanNode {
    counter.count += 1;

    if (counter.count > MAX_PLAN_NODES) {
      counter.truncated = true;
      return {
        nodeType: 'Truncated',
        startupCost: 0,
        totalCost: 0,
        children: [],
      };
    }

    const sortKey = pgNode['Sort Key'];
    const normalizedSortKey = Array.isArray(sortKey)
      ? sortKey.join(', ')
      : sortKey;

    const children: ExplainPlanNode[] = [];
    for (const child of pgNode.Plans ?? []) {
      if (counter.truncated) {
        break;
      }
      children.push(this.mapNode(child, counter));
    }

    return {
      nodeType: pgNode['Node Type'] ?? 'Unknown',
      relationName: pgNode['Relation Name'],
      indexName: pgNode['Index Name'],
      filter: pgNode.Filter,
      sortKey: normalizedSortKey,
      sortMethod: pgNode['Sort Method'],
      startupCost: pgNode['Startup Cost'] ?? 0,
      totalCost: pgNode['Total Cost'] ?? 0,
      planRows: pgNode['Plan Rows'],
      planWidth: pgNode['Plan Width'],
      actualRows: pgNode['Actual Rows'],
      actualLoops: pgNode['Actual Loops'],
      children,
    };
  }
}

export function buildExplainSql(sql: string, explainMode: string): string {
  const trimmed = sql.trim().replace(/;\s*$/, '');

  if (/^\s*EXPLAIN\b/i.test(trimmed)) {
    throw new Error('EXPLAIN_PREFIX_NOT_ALLOWED');
  }

  if (explainMode === 'explain_analyze') {
    return `EXPLAIN (ANALYZE, FORMAT JSON) ${trimmed}`;
  }

  return `EXPLAIN (FORMAT JSON) ${trimmed}`;
}
