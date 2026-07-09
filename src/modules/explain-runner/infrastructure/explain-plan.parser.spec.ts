import { ExplainMode } from '@db-play/types';
import {
  buildExplainSql,
  ExplainPlanParser,
} from './explain-plan.parser';

describe('ExplainPlanParser', () => {
  const parser = new ExplainPlanParser();

  const samplePlanJson = JSON.stringify([
    {
      Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'users',
        'Startup Cost': 0,
        'Total Cost': 100,
        'Plan Rows': 1000,
        'Plan Width': 36,
        Plans: [
          {
            'Node Type': 'Index Scan',
            'Index Name': 'users_pkey',
            'Startup Cost': 0.01,
            'Total Cost': 8.2,
            'Plan Rows': 1,
          },
        ],
      },
      'Planning Time': 0.12,
      'Execution Time': 1.45,
    },
  ]);

  it('parses hierarchical plan nodes from sandbox rows', () => {
    const result = parser.parseFromSandboxRows([
      { 'QUERY PLAN': samplePlanJson },
    ]);

    expect(result.plan.nodeType).toBe('Seq Scan');
    expect(result.plan.relationName).toBe('users');
    expect(result.plan.totalCost).toBe(100);
    expect(result.plan.children).toHaveLength(1);
    expect(result.plan.children[0].nodeType).toBe('Index Scan');
    expect(result.plan.children[0].indexName).toBe('users_pkey');
    expect(result.planningTimeMs).toBe(0.12);
    expect(result.executionTimeMs).toBe(1.45);
    expect(result.rawPlanText).toBe(samplePlanJson);
  });

  it('accepts pre-parsed JSON objects in QUERY PLAN column', () => {
    const parsed = JSON.parse(samplePlanJson);
    const result = parser.parseFromSandboxRows([{ 'QUERY PLAN': parsed }]);

    expect(result.plan.nodeType).toBe('Seq Scan');
  });
});

describe('buildExplainSql', () => {
  it('wraps inner SQL with EXPLAIN FORMAT JSON', () => {
    expect(
      buildExplainSql('SELECT 1', ExplainMode.EXPLAIN),
    ).toBe('EXPLAIN (FORMAT JSON) SELECT 1');
  });

  it('wraps inner SQL with EXPLAIN ANALYZE FORMAT JSON', () => {
    expect(
      buildExplainSql('SELECT 1', ExplainMode.EXPLAIN_ANALYZE),
    ).toBe('EXPLAIN (ANALYZE, FORMAT JSON) SELECT 1');
  });

  it('rejects SQL that already includes EXPLAIN prefix', () => {
    expect(() =>
      buildExplainSql('EXPLAIN SELECT 1', ExplainMode.EXPLAIN),
    ).toThrow('EXPLAIN_PREFIX_NOT_ALLOWED');
  });
});
