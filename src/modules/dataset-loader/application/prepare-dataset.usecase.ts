import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DatasetPreparationStatus,
  DatasetReadinessStatus,
  DatasetTier,
  ErrorCode,
  ExperimentSessionStatus,
  PrepareDatasetInput,
  PrepareDatasetResult,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetSeedRunner } from '../infrastructure/dataset-seed.runner';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';

@Injectable()
export class PrepareDatasetUseCase {
  private readonly logger = new Logger(PrepareDatasetUseCase.name);
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    private readonly manifestRepository: DatasetManifestRepository,
    private readonly seedRunner: DatasetSeedRunner,
    private readonly statusStore: DatasetPreparationStatusStore,
    private readonly configService: ConfigService,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
  ) {}

  async execute(input: PrepareDatasetInput): Promise<PrepareDatasetResult> {
    const schemaName = await this.resolveSchemaName(input.sessionId);
    const version =
      input.version ?? this.manifestRepository.getDefaultVersion();
    const identity = this.manifestRepository.resolveIdentity(
      input.family,
      input.tier,
      version,
    );

    const key = this.statusStore.buildKey(
      identity.family.id,
      identity.version.id,
      input.tier,
      input.sessionId,
    );

    const existing = await this.statusStore.get(
      identity.family.id,
      identity.version.id,
      input.tier,
      input.sessionId,
    );

    if (
      existing?.status === DatasetReadinessStatus.PREPARING &&
      !this.isOrphanedPreparation(existing, key)
    ) {
      return {
        family: identity.family.id,
        version: identity.version.id,
        tier: input.tier,
        status: DatasetReadinessStatus.PREPARING,
        startedAt: existing.startedAt,
      };
    }

    const isSyncTier = this.isSyncTier(input.tier);
    const startedAt = new Date().toISOString();

    await this.statusStore.markPreparing(
      identity.family.id,
      identity.version.id,
      input.tier,
      input.sessionId,
    );

    this.logPreparation('started', input, identity.version.id, startedAt);

    if (isSyncTier) {
      const durationMs = await this.runPreparation(
        input,
        identity.family.id,
        identity.version.id,
        input.tier,
        startedAt,
        schemaName,
      );

      return {
        family: identity.family.id,
        version: identity.version.id,
        tier: input.tier,
        status: DatasetReadinessStatus.READY,
        durationMs,
        startedAt,
      };
    }

    void this.scheduleAsyncPreparation(
      input,
      identity.family.id,
      identity.version.id,
      input.tier,
      startedAt,
      schemaName,
    );

    return {
      family: identity.family.id,
      version: identity.version.id,
      tier: input.tier,
      status: DatasetReadinessStatus.PREPARING,
      startedAt,
    };
  }

  async getStatus(
    family: string,
    tier: DatasetTier,
    version?: string,
    sessionId?: string,
  ): Promise<DatasetPreparationStatus> {
    const resolvedVersion =
      version ?? this.manifestRepository.getDefaultVersion();
    this.manifestRepository.resolveIdentity(family, tier, resolvedVersion);

    const status = await this.statusStore.getOrDefault(
      family,
      resolvedVersion,
      tier,
      sessionId,
    );

    if (status.status === DatasetReadinessStatus.PREPARING) {
      const key = this.statusStore.buildKey(
        family,
        resolvedVersion,
        tier,
        sessionId,
      );
      if (this.isOrphanedPreparation(status, key)) {
        return {
          ...status,
          status: DatasetReadinessStatus.FAILED,
          error: {
            code: 'PREPARATION_STALE',
            message:
              'Dataset preparation did not complete. The previous attempt may have been interrupted.',
            hint: 'Submit prepare again to reload the dataset.',
          },
        };
      }
    }

    return status;
  }

  private async resolveSchemaName(sessionId?: string): Promise<string | undefined> {
    if (!sessionId) {
      return undefined;
    }

    const session = await this.getExperimentSession.execute(sessionId);

    if (session.status !== ExperimentSessionStatus.READY) {
      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        'Experiment session is not ready for dataset preparation.',
        422,
        {
          reason: 'SESSION_NOT_READY',
          status: session.status,
          hint: 'Wait for the experiment session to finish provisioning before preparing the dataset.',
        },
      );
    }

    return session.schemaName;
  }

  private isOrphanedPreparation(
    status: DatasetPreparationStatus,
    key: string,
  ): boolean {
    if (this.inFlight.has(key)) {
      return false;
    }

    if (!status.startedAt) {
      return true;
    }

    const staleMs = this.configService.get<number>(
      'dataset.preparationStaleMs',
      300_000,
    );

    return Date.now() - new Date(status.startedAt).getTime() > staleMs;
  }

  private isSyncTier(tier: DatasetTier): boolean {
    const syncTierMax = this.configService.get<string>(
      'dataset.syncTierMax',
      DatasetTier.TIER_100K,
    );
    const tierOrder = [DatasetTier.TIER_100K, DatasetTier.TIER_1M, DatasetTier.TIER_10M];
    return tierOrder.indexOf(tier) <= tierOrder.indexOf(syncTierMax as DatasetTier);
  }

  private scheduleAsyncPreparation(
    input: PrepareDatasetInput,
    family: string,
    version: string,
    tier: DatasetTier,
    startedAt: string,
    schemaName?: string,
  ): void {
    const key = this.statusStore.buildKey(family, version, tier, input.sessionId);

    if (!this.inFlight.has(key)) {
      const task = this.runPreparation(
        input,
        family,
        version,
        tier,
        startedAt,
        schemaName,
      )
        .then(() => undefined)
        .finally(() => {
          this.inFlight.delete(key);
        });
      this.inFlight.set(key, task);
    }
  }

  private async runPreparation(
    input: PrepareDatasetInput,
    family: string,
    version: string,
    tier: DatasetTier,
    startedAt: string,
    schemaName?: string,
  ): Promise<number> {
    const startedMs = Date.now();

    try {
      const identity = this.manifestRepository.resolveIdentity(
        family,
        tier,
        version,
      );
      await this.seedRunner.run(identity, schemaName);

      const durationMs = Date.now() - startedMs;
      await this.statusStore.markReady(
        family,
        version,
        tier,
        startedAt,
        durationMs,
        input.sessionId,
      );
      this.logPreparation('completed', input, version, startedAt, durationMs);
      return durationMs;
    } catch (error) {
      const preparationError = this.mapPreparationError(error);
      await this.statusStore.markFailed(
        family,
        version,
        tier,
        startedAt,
        preparationError,
        input.sessionId,
      );
      this.logPreparation('failed', input, version, startedAt, undefined, preparationError.code);

      if (this.isSyncTier(tier)) {
        throw new DomainError(
          ErrorCode.EXECUTION_ERROR,
          preparationError.message,
          422,
          preparationError,
        );
      }
    }

    return Date.now() - startedMs;
  }

  private mapPreparationError(error: unknown): {
    code: string;
    message: string;
    hint?: string;
  } {
    if (error instanceof DomainError) {
      const details = error.details as { code?: string; hint?: string } | undefined;
      return {
        code: details?.code ?? error.code,
        message: error.message,
        hint:
          details?.hint ??
          'Dataset preparation failed. Retry preparation or contact support if the issue persists.',
      };
    }

    return {
      code: 'SEED_EXECUTION_FAILED',
      message:
        'Dataset preparation failed while loading playground tables.',
      hint:
        'The playground could not be seeded. Retry preparation — partial data is rolled back automatically.',
    };
  }

  private logPreparation(
    status: 'started' | 'completed' | 'failed',
    input: PrepareDatasetInput,
    version: string,
    startedAt: string,
    durationMs?: number,
    errorCode?: string,
  ): void {
    this.logger.log({
      event: 'dataset_preparation',
      family: input.family,
      version,
      tier: input.tier,
      status,
      durationMs,
      requestId: input.context?.requestId,
      labSlug: input.context?.labSlug,
      sessionId: input.sessionId,
      errorCode,
      startedAt,
    });
  }
}
