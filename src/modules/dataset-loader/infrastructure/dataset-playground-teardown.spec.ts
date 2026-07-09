import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';
import { DatasetPlaygroundTeardown } from './dataset-playground-teardown';

describe('DatasetPlaygroundTeardown', () => {
  let playgroundDb: jest.Mocked<PlaygroundDatabaseService>;
  let teardown: DatasetPlaygroundTeardown;
  let scopedQuery: jest.Mock;

  beforeEach(() => {
    scopedQuery = jest.fn();

    playgroundDb = {
      withSchemaScope: jest.fn(
        async (_schemaName, run) => run(scopedQuery),
      ),
    } as unknown as jest.Mocked<PlaygroundDatabaseService>;

    teardown = new DatasetPlaygroundTeardown(playgroundDb);
  });

  it('drops tables not in the manifest allowlist', async () => {
    scopedQuery
      .mockResolvedValueOnce([
        { table_name: 'users' },
        { table_name: 'learner_scratch' },
        { table_name: 'orders' },
      ])
      .mockResolvedValueOnce([]);

    await teardown.dropExtraTables(['users', 'orders', 'products']);

    expect(scopedQuery).toHaveBeenCalledTimes(2);
    expect(scopedQuery).toHaveBeenNthCalledWith(
      2,
      'DROP TABLE IF EXISTS "learner_scratch" CASCADE',
    );
  });

  it('does not drop allowlisted tables', async () => {
    scopedQuery.mockResolvedValueOnce([
      { table_name: 'users' },
      { table_name: 'payments' },
    ]);

    await teardown.dropExtraTables(['users', 'payments']);

    expect(scopedQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid table identifiers', async () => {
    scopedQuery.mockResolvedValueOnce([{ table_name: 'bad-name;' }]);

    await expect(teardown.dropExtraTables(['users'])).rejects.toThrow(
      'Invalid table identifier',
    );
  });
});
