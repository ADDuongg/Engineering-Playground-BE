import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
}
