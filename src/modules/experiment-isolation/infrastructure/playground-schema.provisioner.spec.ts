import { PlaygroundSchemaProvisioner } from './playground-schema.provisioner';
import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';

describe('PlaygroundSchemaProvisioner', () => {
  let playgroundDb: jest.Mocked<PlaygroundDatabaseService>;
  let provisioner: PlaygroundSchemaProvisioner;

  beforeEach(() => {
    playgroundDb = {
      assertValidSchemaName: jest.fn(),
      quoteIdentifier: jest.fn((name: string) => `"${name}"`),
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PlaygroundDatabaseService>;

    provisioner = new PlaygroundSchemaProvisioner(playgroundDb);
  });

  it('creates schema with validated name', async () => {
    await provisioner.createSchema('exp_abc123def456');

    expect(playgroundDb.assertValidSchemaName).toHaveBeenCalledWith(
      'exp_abc123def456',
    );
    expect(playgroundDb.query).toHaveBeenCalledWith(
      'CREATE SCHEMA IF NOT EXISTS "exp_abc123def456"',
    );
  });

  it('drops schema with cascade', async () => {
    await provisioner.dropSchema('exp_abc123def456');

    expect(playgroundDb.query).toHaveBeenCalledWith(
      'DROP SCHEMA IF EXISTS "exp_abc123def456" CASCADE',
    );
  });

  it('generates schema names with exp_ prefix', () => {
    const name = provisioner.createSchemaName();

    expect(name).toMatch(/^exp_[a-z0-9_]+$/);
  });
});
