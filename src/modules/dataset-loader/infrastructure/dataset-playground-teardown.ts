import { Injectable } from '@nestjs/common';
import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';

@Injectable()
export class DatasetPlaygroundTeardown {
  constructor(private readonly playgroundDb: PlaygroundDatabaseService) {}

  async dropExtraTables(
    allowlistedTables: string[],
    schemaName?: string,
  ): Promise<void> {
    const allowlist = new Set(
      allowlistedTables.map((name) => name.toLowerCase()),
    );

    await this.playgroundDb.withSchemaScope(schemaName, async (query) => {
      const targetSchema = schemaName ?? 'public';
      const rows = (await query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_type = 'BASE TABLE'`,
        [targetSchema],
      )) as { table_name: string }[];

      for (const row of rows) {
        if (!allowlist.has(row.table_name.toLowerCase())) {
          await query(
            `DROP TABLE IF EXISTS ${this.quoteIdentifier(row.table_name)} CASCADE`,
          );
        }
      }
    });
  }

  private quoteIdentifier(identifier: string): string {
    if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
      throw new Error(`Invalid table identifier: ${identifier}`);
    }
    return `"${identifier}"`;
  }
}
