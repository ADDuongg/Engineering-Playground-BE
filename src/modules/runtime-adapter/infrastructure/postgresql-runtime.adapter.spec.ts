import { DatasetTier, RuntimeAdapterType } from '@db-play/types';
import { RunExperimentSqlUseCase } from '../../experiment-runner/application/run-experiment-sql.usecase';
import { PostgresqlRuntimeAdapter } from './postgresql-runtime.adapter';

describe('PostgresqlRuntimeAdapter', () => {
  it('delegates to the SQL runner and maps metrics + raw', async () => {
    const execute = jest.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      truncated: false,
      executionTimeMs: 1,
      dataset: { family: 'commerce', tier: '100k', version: 'v1' },
      statementKind: 'select',
      metrics: [
        { key: 'execution_time_ms', label: 'x', unit: 'ms', group: 'performance', value: 1 },
      ],
    });
    const runner = { execute } as unknown as RunExperimentSqlUseCase;
    const adapter = new PostgresqlRuntimeAdapter(runner);

    expect(adapter.type).toBe(RuntimeAdapterType.PLAYGROUND_POSTGRESQL);

    const result = await adapter.run(
      {
        sql: 'SELECT 1',
        parameters: [],
        dataset: { family: 'commerce', tier: DatasetTier.TIER_100K, version: 'v1' },
      },
      { requestId: 'req-1', userId: 'user-1', sessionId: 'sess-1' },
    );

    expect(result.adapterType).toBe(RuntimeAdapterType.PLAYGROUND_POSTGRESQL);
    expect(result.metrics).toHaveLength(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: 'SELECT 1',
        sessionId: 'sess-1',
        context: expect.objectContaining({
          requestId: 'req-1',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('prefers explicit input context/session over the run context', async () => {
    const execute = jest.fn().mockResolvedValue({
      rows: [],
      rowCount: 0,
      truncated: false,
      executionTimeMs: 1,
      dataset: { family: 'commerce', tier: '100k', version: 'v1' },
      statementKind: 'select',
    });
    const adapter = new PostgresqlRuntimeAdapter({
      execute,
    } as unknown as RunExperimentSqlUseCase);

    const result = await adapter.run(
      {
        sql: 'SELECT 1',
        parameters: [],
        dataset: { family: 'commerce', tier: DatasetTier.TIER_100K, version: 'v1' },
        sessionId: 'input-session',
        context: { requestId: 'input-req' },
      },
      { requestId: 'ctx-req', sessionId: 'ctx-session' },
    );

    expect(result.metrics).toEqual([]);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'input-session',
        context: expect.objectContaining({ requestId: 'input-req' }),
      }),
    );
  });
});
