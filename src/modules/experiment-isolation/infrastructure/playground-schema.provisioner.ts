import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';

@Injectable()
export class PlaygroundSchemaProvisioner {
  constructor(private readonly playgroundDb: PlaygroundDatabaseService) {}

  createSchemaName(): string {
    const shortId = randomUUID().replace(/-/g, '').slice(0, 12);
    return `exp_${shortId}`;
  }

  async createSchema(schemaName: string): Promise<void> {
    this.playgroundDb.assertValidSchemaName(schemaName);
    await this.playgroundDb.query(
      `CREATE SCHEMA IF NOT EXISTS ${this.playgroundDb.quoteIdentifier(schemaName)}`,
    );
  }

  async dropSchema(schemaName: string): Promise<void> {
    this.playgroundDb.assertValidSchemaName(schemaName);
    await this.playgroundDb.query(
      `DROP SCHEMA IF EXISTS ${this.playgroundDb.quoteIdentifier(schemaName)} CASCADE`,
    );
  }
}
