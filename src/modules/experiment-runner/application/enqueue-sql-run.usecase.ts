import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EnqueueSqlRunInput,
  EnqueueSqlRunResult,
  ErrorCode,
  ExperimentSessionStatus,
  JobStatus,
  JobType,
  RateLimitOperation,
  SqlExecutionJobBody,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { ValidateSqlStatementService } from '../../sql-sandbox/application/validate-sql-statement.service';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';
import { EnqueueJobService } from '../../worker-queue/application/enqueue-job.service';
import { JobStore } from '../../worker-queue/infrastructure/job.store';

@Injectable()
export class EnqueueSqlRunUseCase {
  private readonly logger = new Logger(EnqueueSqlRunUseCase.name);

  constructor(
    private readonly validateSql: ValidateSqlStatementService,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly rateLimitService: RateLimitService,
    private readonly jobStore: JobStore,
    private readonly enqueueJobService: EnqueueJobService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: EnqueueSqlRunInput): Promise<EnqueueSqlRunResult> {
    const parameters = input.parameters ?? [];

    const validation = this.validateSql.validate(input.sql, parameters);

    const session = await this.getExperimentSession.execute(input.sessionId);

    if (session.status !== ExperimentSessionStatus.READY) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Experiment session is not available for SQL execution.',
        404,
        {
          reason: 'SESSION_UNAVAILABLE',
          hint: 'Open the lab and wait for the experiment session to be ready before running SQL.',
        },
      );
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        'Experiment session has expired.',
        404,
        {
          reason: 'SESSION_UNAVAILABLE',
          hint: 'Open the lab again to start a new experiment session.',
        },
      );
    }

    const maxInflight = this.configService.get<number>(
      'sqlExecution.maxInflightPerSession',
      1,
    );
    const inflight = await this.jobStore.countInflightBySession(
      input.sessionId,
      JobType.SQL_EXECUTION,
    );

    if (inflight >= maxInflight) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'A SQL run is already in progress for this experiment session.',
        409,
        {
          reason: 'SQL_RUN_INFLIGHT_LIMIT',
          hint: 'Wait for the current run to finish or check its status before submitting another.',
        },
      );
    }

    await this.rateLimitService.consumeQuota({
      operation: RateLimitOperation.SQL_RUN,
      userId: input.context?.userId,
      sessionId: input.sessionId,
    });

    const body: SqlExecutionJobBody = {
      sql: input.sql,
      parameters,
      dataset: input.dataset,
      context: {
        requestId: input.context?.requestId,
        trackSlug: input.context?.trackSlug,
        labSlug: input.context?.labSlug,
        userId: input.context?.userId,
        preAuthorized: true,
      },
    };

    const { job } = await this.enqueueJobService.enqueue<SqlExecutionJobBody>({
      jobType: JobType.SQL_EXECUTION,
      userId: input.context?.userId ?? null,
      sessionId: input.sessionId,
      body,
      payloadSummary: {
        statementKind: validation.statementKind,
        datasetFamily: input.dataset.family,
        datasetTier: input.dataset.tier,
      },
    });

    this.logger.log({
      event: 'sql_run_enqueued',
      jobId: job.id,
      sessionId: input.sessionId,
      statementKind: validation.statementKind,
    });

    return {
      jobId: job.id,
      jobType: JobType.SQL_EXECUTION,
      status: JobStatus.QUEUED,
      createdAt: job.createdAt,
    };
  }
}
