import { Injectable, Logger } from '@nestjs/common';
import {
  DatasetReadinessStatus,
  ErrorCode,
  ExplainMode,
  ExplainRunInput,
  ExplainRunResult,
  ExperimentSessionStatus,
  RateLimitOperation,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetDatasetMetadataUseCase } from '../../dataset-loader/application/get-dataset-metadata.usecase';
import { ExecuteSandboxedSqlUseCase } from '../../sql-sandbox/application/execute-sandboxed-sql.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { MetricsEnrichmentService } from '../../metrics-pipeline/application/metrics-enrichment.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';
import {
  buildExplainSql,
  ExplainPlanParser,
} from '../infrastructure/explain-plan.parser';

const NOT_READY_HINTS: Record<DatasetReadinessStatus, string> = {
  [DatasetReadinessStatus.NOT_STARTED]:
    'Prepare the dataset before running EXPLAIN.',
  [DatasetReadinessStatus.PREPARING]:
    'Wait for dataset preparation to complete before running EXPLAIN.',
  [DatasetReadinessStatus.RESETTING]:
    'Wait for dataset reset to complete before running EXPLAIN.',
  [DatasetReadinessStatus.FAILED]:
    'Dataset preparation or reset failed. Retry prepare or reset before running EXPLAIN.',
  [DatasetReadinessStatus.READY]: '',
};

@Injectable()
export class RunExplainUseCase {
  private readonly logger = new Logger(RunExplainUseCase.name);
  private readonly planParser = new ExplainPlanParser();

  constructor(
    private readonly getDatasetMetadata: GetDatasetMetadataUseCase,
    private readonly executeSandboxedSql: ExecuteSandboxedSqlUseCase,
    private readonly validateSql: ValidateSqlStatementService,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly metricsEnrichment: MetricsEnrichmentService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async execute(input: ExplainRunInput): Promise<ExplainRunResult> {
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

    let explainSql: string;
    try {
      explainSql = buildExplainSql(input.sql, input.explainMode);
    } catch {
      const error = new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Submit the query without an EXPLAIN prefix and set explainMode instead.',
        400,
        {
          reason: 'EXPLAIN_PREFIX_NOT_ALLOWED',
          hint: 'Use explainMode "explain" or "explain_analyze" with the inner SQL only.',
          supportedModes: [ExplainMode.EXPLAIN, ExplainMode.EXPLAIN_ANALYZE],
        },
      );
      this.logRun('failed', input, metadata.version, startedAt, error);
      throw error;
    }

    try {
      this.validateSql.validate(explainSql, input.parameters);

      await this.rateLimitService.consumeQuota({
        operation: RateLimitOperation.EXPLAIN_RUN,
        userId: input.context?.userId,
        sessionId: input.sessionId,
      });

      const sandboxResult = await this.executeSandboxedSql.execute({
        sql: explainSql,
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

      const parsedPlan = this.planParser.parseFromSandboxRows(
        sandboxResult.rows,
      );

      const result: ExplainRunResult = {
        plan: parsedPlan.plan,
        planningTimeMs: parsedPlan.planningTimeMs,
        executionTimeMs: sandboxResult.executionTimeMs,
        explainMode: input.explainMode,
        statementKind: input.explainMode,
        dataset: {
          family: metadata.family,
          tier: metadata.tier,
          version: metadata.version,
        },
        truncated: parsedPlan.truncated || undefined,
        rawPlanText: parsedPlan.rawPlanText,
      };

      const enriched = await this.metricsEnrichment.enrichExplainResult(
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
        planNodeCount: this.countPlanNodes(enriched.plan),
        topLevelNodeType: enriched.plan.nodeType,
        statementKind: enriched.statementKind,
      });

      return enriched;
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_EXPLAIN_JSON') {
        const parseError = new DomainError(
          ErrorCode.EXECUTION_ERROR,
          'The database returned an explain plan that could not be parsed.',
          422,
          {
            reason: 'INVALID_EXPLAIN_PLAN',
            hint: 'Retry the explain request or simplify the query.',
          },
        );
        this.logRun('failed', input, metadata.version, startedAt, parseError);
        throw parseError;
      }

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
        'Experiment session is not ready for explain execution.',
        422,
        {
          reason: 'SESSION_NOT_READY',
          status: session.status,
          hint: 'Wait for the experiment session to finish provisioning before running EXPLAIN.',
        },
      );
    }

    return session.schemaName;
  }

  private buildNotReadyError(status: DatasetReadinessStatus): DomainError {
    const hint = NOT_READY_HINTS[status];

    return new DomainError(
      ErrorCode.EXECUTION_ERROR,
      'The playground dataset is not ready for explain execution.',
      422,
      {
        reason: 'DATASET_NOT_READY',
        status,
        hint,
      },
    );
  }

  private countPlanNodes(node: ExplainRunResult['plan']): number {
    return (
      1 + node.children.reduce((sum, child) => sum + this.countPlanNodes(child), 0)
    );
  }

  private logRun(
    phase: 'started' | 'completed' | 'failed',
    input: ExplainRunInput,
    version: string,
    startedAt?: number,
    error?: unknown,
    completion?: {
      planNodeCount: number;
      topLevelNodeType: string;
      statementKind: string;
    },
  ): void {
    const payload: Record<string, unknown> = {
      event: 'explain_sql_run',
      phase,
      explainMode: input.explainMode,
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
      payload.planNodeCount = completion.planNodeCount;
      payload.topLevelNodeType = completion.topLevelNodeType;
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
