import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

export type PlaygroundScopedQuery = (
  sql: string,
  parameters?: unknown[],
) => Promise<unknown[]>;

const SCHEMA_NAME_PATTERN = /^exp_[a-z0-9_]+$/;

@Injectable()
export class PlaygroundDatabaseService {
  constructor(
    @InjectDataSource('playground')
    private readonly dataSource: DataSource,
  ) {}

  async query<T = unknown>(
    sql: string,
    parameters?: unknown[],
  ): Promise<T[]> {
    return this.dataSource.query(sql, parameters);
  }

  async ping(): Promise<boolean> {
    await this.dataSource.query('SELECT 1');
    return true;
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  assertValidSchemaName(schemaName: string): void {
    if (!SCHEMA_NAME_PATTERN.test(schemaName)) {
      throw new Error(`Invalid playground schema name: ${schemaName}`);
    }
  }

  quoteIdentifier(identifier: string): string {
    this.assertValidSchemaName(identifier);
    return `"${identifier}"`;
  }

  async withSchemaScope<T>(
    schemaName: string | undefined,
    run: (query: PlaygroundScopedQuery) => Promise<T>,
  ): Promise<T> {
    if (!schemaName) {
      return run((sql, parameters) => this.query(sql, parameters));
    }

    this.assertValidSchemaName(schemaName);
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `SET LOCAL search_path TO ${this.quoteIdentifier(schemaName)}, public`,
      );

      const scopedQuery: PlaygroundScopedQuery = (sql, parameters) =>
        queryRunner.query(sql, parameters);

      const result = await run(scopedQuery);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async withSchemaScopeOnRunner<T>(
    queryRunner: QueryRunner,
    schemaName: string | undefined,
    run: (query: PlaygroundScopedQuery) => Promise<T>,
  ): Promise<T> {
    if (!schemaName) {
      return run((sql, parameters) => queryRunner.query(sql, parameters));
    }

    this.assertValidSchemaName(schemaName);
    await queryRunner.query(
      `SET LOCAL search_path TO ${this.quoteIdentifier(schemaName)}, public`,
    );

    return run((sql, parameters) => queryRunner.query(sql, parameters));
  }
}
