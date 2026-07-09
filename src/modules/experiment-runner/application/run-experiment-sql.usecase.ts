import { Injectable, Logger } from '@nestjs/common';
import {
  DatasetReadinessStatus,
  ErrorCode,
  ExperimentRunInput,
  ExperimentRunResult,
  ExperimentSessionStatus,
  RateLimitOperation,
  SandboxResultField,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetDatasetMetadataUseCase } from '../../dataset-loader/application/get-dataset-metadata.usecase';
import { ExecuteSandboxedSqlUseCase } from '../../sql-sandbox/application/execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { MetricsEnrichmentService } from '../../metrics-pipeline/application/metrics-enrichment.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';

const NOT_READY_HINTS: Record<DatasetReadinessStatus, string> = {
  [DatasetReadinessStatus.NOT_STARTED]:
    'Prepare the dataset before running SQL.',
  [DatasetReadinessStatus.PREPARING]:
    'Wait for dataset preparation to complete before running SQL.',
  [DatasetReadinessStatus.RESETTING]:
    'Wait for dataset reset to complete before running SQL.',
  [DatasetReadinessStatus.FAILED]:
    'Dataset preparation or reset failed. Retry prepare or reset before running SQL.',
  [DatasetReadinessStatus.READY]: '',
};

@Injectable()
export class RunExperimentSqlUseCase {
  private readonly logger = new Logger(RunExperimentSqlUseCase.name);

  constructor(
    private readonly getDatasetMetadata: GetDatasetMetadataUseCase,
    private readonly executeSandboxedSql: ExecuteSandboxedSqlUseCase,
    private readonly validateSql: ValidateSqlStatementService,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly metricsEnrichment: MetricsEnrichmentService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async execute(input: ExperimentRunInput): Promise<ExperimentRunResult> {
    const startedAt = Date.now();
    const schemaName = await this.resolveSchemaName(input.sessionId);

    const metadata = await this.getDatasetMetadata.execute(
      input.dataset.family,
      input.dataset.tier,
      input.dataset.version,
      input.sessionId,
    );

    this.logRun('started', input, metadata.version);

    if (metadata.status !== DatasetReadinessStatus.READY) {
      const error = this.buildNotReadyError(metadata.status);
      this.logRun('failed', input, metadata.version, startedAt, error);
      throw error;
    }

    let statementKind;
    try {
      const validation = this.validateSql.validate(
        input.sql,
        input.parameters,
      );
      statementKind = validation.statementKind;

      if (!input.context?.benchmarkInternal && !input.context?.preAuthorized) {
        await this.rateLimitService.consumeQuota({
          operation: RateLimitOperation.SQL_RUN,
          userId: input.context?.userId,
          sessionId: input.sessionId,
        });
      }

      const sandboxResult = await this.executeSandboxedSql.execute({
        sql: input.sql,
        parameters: input.parameters,
        sessionId: input.sessionId,
        schemaName,
        context: {
          requestId: input.context?.requestId,
          trackSlug: input.context?.trackSlug,
          labSlug: input.context?.labSlug,
          userId: input.context?.userId,
        },
      });

      const result: ExperimentRunResult = {
        rows: sandboxResult.rows,
        rowCount: sandboxResult.rowCount,
        truncated: sandboxResult.truncated,
        executionTimeMs: sandboxResult.executionTimeMs,
        fields: this.resolveFields(sandboxResult.fields, sandboxResult.rows),
        dataset: {
          family: metadata.family,
          tier: metadata.tier,
          version: metadata.version,
        },
        statementKind,
      };

      const enriched = await this.metricsEnrichment.enrichExecutionResult(
        result,
        {
          sessionId: input.sessionId,
          trackSlug: input.context?.trackSlug,
          labSlug: input.context?.labSlug,
          requestId: input.context?.requestId,
          userId: input.context?.userId,
        },
      );

      this.logRun('completed', input, metadata.version, startedAt, undefined, {
        rowCount: enriched.rowCount,
        statementKind: enriched.statementKind,
      });

      return enriched;
    } catch (error) {
      this.logRun('failed', input, metadata.version, startedAt, error);
      throw error;
    }
  }

  private async resolveSchemaName(sessionId?: string): Promise<string | undefined> {
    if (!sessionId) {
      return undefined;
    }

    const session = await this.getExperimentSession.execute(sessionId);

    if (session.status !== ExperimentSessionStatus.READY) {
      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        'Experiment session is not ready for SQL execution.',
        422,
        {
          reason: 'SESSION_NOT_READY',
          status: session.status,
          hint: 'Wait for the experiment session to finish provisioning before running SQL.',
        },
      );
    }

    return session.schemaName;
  }

  private buildNotReadyError(status: DatasetReadinessStatus): DomainError {
    const hint = NOT_READY_HINTS[status];

    return new DomainError(
      ErrorCode.EXECUTION_ERROR,
      'The playground dataset is not ready for SQL execution.',
      422,
      {
        reason: 'DATASET_NOT_READY',
        status,
        hint,
      },
    );
  }

  private resolveFields(
    fields: SandboxResultField[] | undefined,
    rows: Record<string, unknown>[],
  ): SandboxResultField[] | undefined {
    if (fields?.length) {
      return fields;
    }

    if (rows.length === 0) {
      return undefined;
    }

    return Object.keys(rows[0]).map((name) => ({
      name,
      dataTypeId: 0,
    }));
  }

  private logRun(
    phase: 'started' | 'completed' | 'failed',
    input: ExperimentRunInput,
    version: string,
    startedAt?: number,
    error?: unknown,
    completion?: { rowCount: number; statementKind: string },
  ): void {
    const payload: Record<string, unknown> = {
      event: 'experiment_sql_run',
      phase,
      family: input.dataset.family,
      version,
      tier: input.dataset.tier,
      trackSlug: input.context?.trackSlug,
      labSlug: input.context?.labSlug,
      userId: input.context?.userId,
      requestId: input.context?.requestId,
      sessionId: input.sessionId,
    };

    if (startedAt !== undefined && phase !== 'started') {
      payload.durationMs = Date.now() - startedAt;
    }

    if (completion) {
      payload.rowCount = completion.rowCount;
      payload.statementKind = completion.statementKind;
    }

    if (error instanceof DomainError) {
      payload.errorCode = error.code;
    } else if (error instanceof Error) {
      payload.errorCode = ErrorCode.EXECUTION_ERROR;
    }

    if (phase === 'failed') {
      this.logger.warn(payload);
      return;
    }

    this.logger.log(payload);
  }
}
