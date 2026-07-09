import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  ErrorCode,
  ExperimentSession,
  ExperimentSessionStatus,
  ExperimentSessionSummary,
  ProvisionExperimentSessionInput,
  RuntimeAdapterType,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetTrackBySlugUseCase } from '../../tracks/application/get-track-by-slug.usecase';
import { ExperimentSessionStore } from '../infrastructure/experiment-session.store';
import { PlaygroundSchemaProvisioner } from '../infrastructure/playground-schema.provisioner';

@Injectable()
export class ProvisionExperimentSessionUseCase {
  private readonly logger = new Logger(ProvisionExperimentSessionUseCase.name);

  constructor(
    private readonly sessionStore: ExperimentSessionStore,
    private readonly schemaProvisioner: PlaygroundSchemaProvisioner,
    private readonly getTrackBySlug: GetTrackBySlugUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: ProvisionExperimentSessionInput,
  ): Promise<ExperimentSessionSummary> {
    const existing = await this.sessionStore.findByLookup(
      input.clientSessionToken,
      input.trackSlug,
      input.labSlug,
    );

    if (existing && this.isReusable(existing)) {
      const touched = await this.sessionStore.touchActivity(existing);
      return this.toSummary(touched, true);
    }

    const track = await this.getTrackBySlug.execute(input.trackSlug);

    if (track.runtimeAdapterType !== RuntimeAdapterType.PLAYGROUND_POSTGRESQL) {
      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        `Track "${input.trackSlug}" does not support experiment isolation on this platform yet.`,
        422,
        {
          reason: 'ISOLATION_UNSUPPORTED_TRACK',
          trackSlug: input.trackSlug,
          hint: 'This Track runtime is not available yet. Try a Database Track lab.',
        },
      );
    }

    const sessionId = randomUUID();
    const schemaName = this.schemaProvisioner.createSchemaName();
    const now = new Date().toISOString();
    const ttlSeconds = this.configService.get<number>(
      'experiment.sessionIdleTtlSeconds',
      3600,
    );

    const session: ExperimentSession = {
      sessionId,
      clientSessionToken: input.clientSessionToken,
      status: ExperimentSessionStatus.PROVISIONING,
      trackSlug: input.trackSlug,
      labSlug: input.labSlug,
      runtimeAdapter: track.runtimeAdapterType,
      schemaName,
      dataset: input.dataset,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };

    await this.sessionStore.save(session);
    this.logSession('provision_started', session, input.context?.requestId);

    try {
      await this.schemaProvisioner.createSchema(schemaName);

      const readySession: ExperimentSession = {
        ...session,
        status: ExperimentSessionStatus.READY,
      };

      await this.sessionStore.save(readySession);
      this.logSession(
        'provision_completed',
        readySession,
        input.context?.requestId,
        Date.now() - new Date(now).getTime(),
      );

      return this.toSummary(readySession, false);
    } catch (error) {
      await this.schemaProvisioner.dropSchema(schemaName).catch(() => undefined);

      const failedSession: ExperimentSession = {
        ...session,
        status: ExperimentSessionStatus.FAILED,
        error: {
          code: 'ISOLATION_PROVISION_FAILED',
          message: 'Experiment session could not be provisioned.',
          hint: 'Retry opening the lab. Contact support if this persists.',
        },
      };

      await this.sessionStore.save(failedSession);
      this.logSession(
        'provision_failed',
        failedSession,
        input.context?.requestId,
        Date.now() - new Date(now).getTime(),
        'ISOLATION_PROVISION_FAILED',
      );

      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        failedSession.error!.message,
        422,
        {
          reason: 'ISOLATION_PROVISION_FAILED',
          hint: failedSession.error!.hint,
        },
      );
    }
  }

  private isReusable(session: ExperimentSession): boolean {
    return (
      session.status === ExperimentSessionStatus.READY &&
      new Date(session.expiresAt).getTime() > Date.now()
    );
  }

  private toSummary(
    session: ExperimentSession,
    reused: boolean,
  ): ExperimentSessionSummary {
    return {
      sessionId: session.sessionId,
      status: session.status,
      trackSlug: session.trackSlug,
      labSlug: session.labSlug,
      runtimeAdapter: session.runtimeAdapter,
      schemaName: session.schemaName,
      dataset: {
        ...session.dataset,
        version: session.dataset.version ?? 'v1',
      },
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      reused,
    };
  }

  private logSession(
    phase:
      | 'provision_started'
      | 'provision_completed'
      | 'provision_failed',
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

    if (phase === 'provision_failed') {
      this.logger.warn(payload);
      return;
    }

    this.logger.log(payload);
  }
}
