import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';
import { ResolvedDatasetIdentity } from '../domain/dataset-manifest.types';
import { DatasetManifestRepository } from './dataset-manifest.repository';

@Injectable()
export class DatasetSeedRunner {
  constructor(
    private readonly playgroundDb: PlaygroundDatabaseService,
    private readonly manifestRepository: DatasetManifestRepository,
  ) {}

  async run(
    identity: ResolvedDatasetIdentity,
    schemaName?: string,
  ): Promise<void> {
    const seedsRoot = this.manifestRepository.getSeedsRoot();
    const schemaSql = readFileSync(
      join(seedsRoot, identity.version.schemaPath),
      'utf-8',
    );
    const seedSql = readFileSync(
      join(seedsRoot, identity.tier.seedPath),
      'utf-8',
    );

    await this.playgroundDb.withSchemaScope(schemaName, async (query) => {
      await query(schemaSql);
      await query(seedSql);
    });
  }

  async countTableRows(
    tableName: string,
    schemaName?: string,
  ): Promise<number> {
    return this.playgroundDb.withSchemaScope(schemaName, async (query) => {
      const rows = (await query(
        `SELECT COUNT(*)::text AS count FROM ${this.quoteIdentifier(tableName)}`,
      )) as { count: string }[];

      return parseInt(rows[0]?.count ?? '0', 10);
    });
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
      throw new Error(`Invalid table identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }
}
