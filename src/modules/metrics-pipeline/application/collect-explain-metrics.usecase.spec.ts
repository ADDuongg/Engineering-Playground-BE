import {
  DatasetTier,
  ExplainMode,
  MetricCatalogId,
} from '@db-play/types';
import { CollectExplainMetricsUseCase } from './collect-explain-metrics.usecase';

describe('CollectExplainMetricsUseCase', () => {
  const useCase = new CollectExplainMetricsUseCase();

  const baseContext = {
    runType: 'explain' as const,
    sessionId: 'session-1',
    labSlug: 'explain-analyze',
    trackSlug: 'database-sql',
    metricCatalogId: MetricCatalogId.DATABASE,
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
  };

  it('flags sequential scan usage from plan tree', () => {
    const result = useCase.execute(
      {
        plan: {
          nodeType: 'Seq Scan',
          relationName: 'users',
          startupCost: 0,
          totalCost: 100,
          planRows: 1000,
          children: [],
        },
        executionTimeMs: 15,
        explainMode: ExplainMode.EXPLAIN,
        statementKind: ExplainMode.EXPLAIN,
        dataset: baseContext.dataset,
      },
      baseContext,
    );

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'seq_scan_used', value: 1 }),
        expect.objectContaining({ key: 'index_scan_used', value: 0 }),
        expect.objectContaining({ key: 'rows_scanned', value: 1000 }),
      ]),
    );
    expect(result.omittedMetricKeys).toEqual(
      expect.arrayContaining(['planning_time_ms', 'plan_execution_time_ms']),
    );
  });

  it('flags index scan usage when index name is present', () => {
    const result = useCase.execute(
      {
        plan: {
          nodeType: 'Index Scan',
          relationName: 'users',
          indexName: 'users_pkey',
          startupCost: 0,
          totalCost: 8,
          actualRows: 1,
          actualLoops: 1,
          children: [],
        },
        planningTimeMs: 0.2,
        executionTimeMs: 1.5,
        explainMode: ExplainMode.EXPLAIN_ANALYZE,
        statementKind: ExplainMode.EXPLAIN_ANALYZE,
        dataset: baseContext.dataset,
      },
      baseContext,
    );

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'index_scan_used', value: 1 }),
        expect.objectContaining({ key: 'seq_scan_used', value: 0 }),
        expect.objectContaining({ key: 'planning_time_ms', value: 0.2 }),
        expect.objectContaining({ key: 'plan_execution_time_ms', value: 1.5 }),
      ]),
    );
  });
});
