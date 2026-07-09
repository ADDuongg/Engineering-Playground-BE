import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  ErrorCode,
  SandboxExecuteInput,
  SandboxExecuteResult,
  SandboxViolationCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { PlaygroundDatabaseService } from '../../../database/playground/playground-database.service';
import { ValidateSqlStatementService } from './validate-sql-statement.service';
import {
  DEFAULT_SANDBOX_CONFIG,
  SANDBOX_CONFIG,
  SandboxConfig,
} from '../config/sandbox.config';

@Injectable()
export class ExecuteSandboxedSqlUseCase {
  private readonly logger = new Logger(ExecuteSandboxedSqlUseCase.name);

  constructor(
    private readonly validateSql: ValidateSqlStatementService,
    private readonly playgroundDb: PlaygroundDatabaseService,
    @Inject(SANDBOX_CONFIG)
    private readonly config: SandboxConfig = DEFAULT_SANDBOX_CONFIG,
  ) {}

  async execute(input: SandboxExecuteInput): Promise<SandboxExecuteResult> {
    const startedAt = Date.now();

    let validation;
    try {
      validation = this.validateSql.validate(input.sql, input.parameters);
    } catch (error) {
      this.logViolation(error, input);
      throw error;
    }

    const sqlToRun = validation.normalizedSql;

    const dataSource = this.playgroundDb.getDataSource();
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.playgroundDb.withSchemaScopeOnRunner(
        queryRunner,
        input.schemaName,
        async (query) => {
          await query(
            `SET LOCAL statement_timeout = '${this.config.queryTimeoutMs}ms'`,
          );

          const rows = (await query(
            sqlToRun,
            input.parameters,
          )) as Record<string, unknown>[];

          const maxRows = this.config.maxRows;
          const truncated = rows.length > maxRows;
          const boundedRows = truncated ? rows.slice(0, maxRows) : rows;

          return {
            rows: boundedRows,
            rowCount: boundedRows.length,
            truncated,
            executionTimeMs: Date.now() - startedAt,
          };
        },
      );

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logViolation(error, input);
      throw this.mapExecutionError(error);
    } finally {
      await queryRunner.release();
    }
  }

  private mapExecutionError(error: unknown): DomainError {
    if (error instanceof DomainError) {
      return error;
    }

    const pgError = error as { code?: string; message?: string };

    if (this.isTimeoutError(pgError)) {
      return new DomainError(
        ErrorCode.TIMEOUT,
        'The query exceeded the allowed execution time.',
        408,
        {
          violationCode: SandboxViolationCode.QUERY_TIMEOUT,
          hint: 'Try narrowing the query, adding an index, or reducing scanned rows. Sequential scans on large tables often hit this limit.',
          policyVersion: this.config.policyVersion,
        },
      );
    }

    const message =
      pgError.message ??
      'The query failed during playground execution.';

    return new DomainError(ErrorCode.EXECUTION_ERROR, message, 422, {
      violationCode: SandboxViolationCode.EXECUTION_FAILED,
      hint: 'Review SQL syntax and ensure referenced tables and columns exist in the playground dataset.',
      policyVersion: this.config.policyVersion,
    });
  }

  private isTimeoutError(error: { code?: string; message?: string }): boolean {
    return (
      error.code === '57014' ||
      /statement timeout|canceling statement due to statement timeout/i.test(
        error.message ?? '',
      )
    );
  }

  private logViolation(error: unknown, input: SandboxExecuteInput): void {
    if (!(error instanceof DomainError)) {
      return;
    }

    const details = error.details as
      | { violationCode?: SandboxViolationCode }
      | undefined;

    this.logger.warn({
      msg: 'sql_sandbox_violation',
      violationCode: details?.violationCode,
      policyVersion: this.config.policyVersion,
      requestId: input.context?.requestId,
      trackSlug: input.context?.trackSlug,
      labSlug: input.context?.labSlug,
      userId: input.context?.userId,
      sessionId: input.sessionId,
      errorCode: error.code,
    });
  }
}
