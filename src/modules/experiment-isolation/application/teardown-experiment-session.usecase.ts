import { Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  ExperimentSession,
  ExperimentSessionStatus,
  TeardownExperimentSessionInput,
  TeardownExperimentSessionResult,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { CancelSessionJobsUseCase } from '../../worker-queue/application/cancel-session-jobs.usecase';
import { GetExperimentSessionUseCase } from './get-experiment-session.usecase';
import { ExperimentSessionStore } from '../infrastructure/experiment-session.store';
import { PlaygroundSchemaProvisioner } from '../infrastructure/playground-schema.provisioner';

@Injectable()
export class TeardownExperimentSessionUseCase {
  private readonly logger = new Logger(TeardownExperimentSessionUseCase.name);

  constructor(
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly sessionStore: ExperimentSessionStore,
    private readonly schemaProvisioner: PlaygroundSchemaProvisioner,
    private readonly cancelSessionJobs: CancelSessionJobsUseCase,
  ) {}

  async execute(
    input: TeardownExperimentSessionInput,
  ): Promise<TeardownExperimentSessionResult> {
    const session = await this.getExperimentSession.execute(input.sessionId);
    const startedMs = Date.now();

    await this.markTearingDown(session);
    await this.cancelSessionJobsBestEffort(input.sessionId);
    this.logSession('teardown_started', session, input.context?.requestId);

    try {
      await this.schemaProvisioner.dropSchema(session.schemaName);
      await this.sessionStore.delete(session);

      const durationMs = Date.now() - startedMs;
      this.logSession(
        'teardown_completed',
        session,
        input.context?.requestId,
        durationMs,
      );

      return {
        sessionId: session.sessionId,
        status: ExperimentSessionStatus.EXPIRED,
        durationMs,
      };
    } catch (error) {
      await this.markFailed(session);
      this.logSession(
        'teardown_failed',
        session,
        input.context?.requestId,
        Date.now() - startedMs,
        'ISOLATION_TEARDOWN_FAILED',
      );

      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        'Experiment session teardown failed.',
        422,
        {
          reason: 'ISOLATION_TEARDOWN_FAILED',
          hint: 'The session may already be expired. Open the lab again to start fresh.',
        },
      );
    }
  }

  private async markTearingDown(session: ExperimentSession): Promise<void> {
    await this.sessionStore.save({
      ...session,
      status: ExperimentSessionStatus.TEARING_DOWN,
    });
  }

  private async cancelSessionJobsBestEffort(sessionId: string): Promise<void> {
    try {
      await this.cancelSessionJobs.execute({
        sessionId,
        reason: 'SESSION_TEARDOWN',
      });
    } catch (error) {
      this.logger.warn(
        {
          event: 'experiment_session',
          phase: 'cancel_session_jobs_failed',
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Best-effort session job cancel failed; continuing teardown',
      );
    }
  }

  private async markFailed(session: ExperimentSession): Promise<void> {
    await this.sessionStore.save({
      ...session,
      status: ExperimentSessionStatus.FAILED,
      error: {
        code: 'ISOLATION_TEARDOWN_FAILED',
        message: 'Experiment session teardown failed.',
        hint: 'Open the lab again to start a new session.',
      },
    });
  }

  private logSession(
    phase:
      | 'teardown_started'
      | 'teardown_completed'
      | 'teardown_failed',
    session: ExperimentSession,
    requestId?: string,
    durationMs?: number,
    errorCode?: string,
  ): void {
    const payload: Record<string, unknown> = {
      event: 'experiment_session',
      phase,
      sessionId: session.sessionId,
      trackSlug: session.trackSlug,
      labSlug: session.labSlug,
      schemaName: session.schemaName,
      requestId,
    };

    if (durationMs !== undefined) {
      payload.durationMs = durationMs;
    }

    if (errorCode) {
      payload.errorCode = errorCode;
    }

    if (phase === 'teardown_failed') {
      this.logger.warn(payload);
      return;
    }

    this.logger.log(payload);
  }
}
