import { Injectable } from '@nestjs/common';
import {
  ExperimentRunInput,
  ExperimentRunResult,
  RuntimeAdapterType,
  RuntimeExperimentContext,
  RuntimeExperimentResult,
} from '@db-play/types';
import { RunExperimentSqlUseCase } from '../../experiment-runner/application/run-experiment-sql.usecase';
import { RuntimeAdapter } from '../domain/runtime-adapter';

/**
 * Database / SQL runtime. Wraps the existing SQL execution use case so the SQL
 * runner is consumable through the uniform Runtime Adapter interface.
 */
@Injectable()
export class PostgresqlRuntimeAdapter
  implements RuntimeAdapter<ExperimentRunInput, ExperimentRunResult>
{
  readonly type = RuntimeAdapterType.PLAYGROUND_POSTGRESQL;

  constructor(private readonly runExperimentSql: RunExperimentSqlUseCase) {}

  async run(
    input: ExperimentRunInput,
    context: RuntimeExperimentContext,
  ): Promise<RuntimeExperimentResult<ExperimentRunResult>> {
    const merged: ExperimentRunInput = {
      ...input,
      sessionId: input.sessionId ?? context.sessionId,
      context: {
        ...input.context,
        requestId: input.context?.requestId ?? context.requestId,
        trackSlug: input.context?.trackSlug ?? context.trackSlug,
        labSlug: input.context?.labSlug ?? context.labSlug,
        userId: input.context?.userId ?? context.userId,
      },
    };

    const result = await this.runExperimentSql.execute(merged);

    return {
      adapterType: this.type,
      metrics: result.metrics ?? [],
      raw: result,
    };
  }
}
