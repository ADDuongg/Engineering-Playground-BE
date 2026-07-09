import {
  DatasetTier,
  ExplainMode,
  MetricCatalogId,
  SqlStatementKind,
} from '@db-play/types';
import { CollectExecutionMetricsUseCase } from './collect-execution-metrics.usecase';

describe('CollectExecutionMetricsUseCase', () => {
  const useCase = new CollectExecutionMetricsUseCase();

  const baseContext = {
    runType: 'execution' as const,
    sessionId: 'session-1',
    labSlug: 'index-playground',
    trackSlug: 'database-sql',
    metricCatalogId: MetricCatalogId.DATABASE,
    dataset: {
      family: 'commerce',
      tier: DatasetTier.TIER_100K,
      version: 'v1',
    },
  };

  it('emits execution_time_ms and rows_returned for successful runs', () => {
    const result = useCase.execute(
      {
        rows: [{ cnt: 42 }],
        rowCount: 42,
        truncated: false,
        executionTimeMs: 25,
        dataset: baseContext.dataset,
        statementKind: SqlStatementKind.SELECT,
      },
      baseContext,
    );

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'execution_time_ms',
          value: 25,
          unit: 'ms',
          group: 'performance',
        }),
        expect.objectContaining({
          key: 'rows_returned',
          value: 42,
          unit: 'rows',
          group: 'scan',
        }),
      ]),
    );
    expect(result.omittedMetricKeys).toEqual(
      expect.arrayContaining(['rows_scanned', 'index_scan_used']),
    );
  });

  it('records zero rows returned without omitting the metric', () => {
    const result = useCase.execute(
      {
        rows: [],
        rowCount: 0,
        truncated: false,
        executionTimeMs: 5,
        dataset: baseContext.dataset,
        statementKind: SqlStatementKind.SELECT,
      },
      baseContext,
    );

    const rowsReturned = result.metrics.find(
      (metric) => metric.key === 'rows_returned',
    );
    expect(rowsReturned?.value).toBe(0);
  });
});
