import { Injectable, Logger } from '@nestjs/common';
import {
  DatasetResetContext,
  DatasetTier,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetSeedRunner } from '../infrastructure/dataset-seed.runner';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';
import { DatasetPlaygroundTeardown } from '../infrastructure/dataset-playground-teardown';

export interface ExecuteDatasetResetInput {
  family: string;
  tier: DatasetTier;
  version: string;
  sessionId?: string;
  schemaName?: string;
  context?: DatasetResetContext;
}

@Injectable()
export class ExecuteDatasetResetService {
  private readonly logger = new Logger(ExecuteDatasetResetService.name);

  constructor(
    private readonly manifestRepository: DatasetManifestRepository,
    private readonly teardown: DatasetPlaygroundTeardown,
    private readonly seedRunner: DatasetSeedRunner,
    private readonly statusStore: DatasetPreparationStatusStore,
  ) {}

  async execute(input: ExecuteDatasetResetInput): Promise<number> {
    const identity = this.manifestRepository.resolveIdentity(
      input.family,
      input.tier,
      input.version,
    );
    const family = identity.family.id;
    const version = identity.version.id;
    const tier = input.tier;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    await this.statusStore.markResetting(
      family,
      version,
      tier,
      input.sessionId,
    );

    this.logReset('started', input, version, startedAt);

    try {
      const allowlistedTables = identity.tier.tables.map((table) => table.name);
      await this.teardown.dropExtraTables(allowlistedTables, input.schemaName);
      await this.seedRunner.run(identity, input.schemaName);

      const durationMs = Date.now() - startedMs;
      await this.statusStore.markReady(
        family,
        version,
        tier,
        startedAt,
        durationMs,
        input.sessionId,
      );
      this.logReset('completed', input, version, startedAt, durationMs);
      return durationMs;
    } catch (error) {
      const resetError = this.mapResetError(error);
      await this.statusStore.markFailed(
        family,
        version,
        tier,
        startedAt,
        resetError,
        input.sessionId,
      );
      this.logReset(
        'failed',
        input,
        version,
        startedAt,
        undefined,
        resetError.code,
      );

      throw new DomainError(
        ErrorCode.EXECUTION_ERROR,
        resetError.message,
        422,
        resetError,
      );
    }
  }

  private mapResetError(error: unknown): {
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
          'Dataset reset failed. Retry reset or contact support if the issue persists.',
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    const isLockConflict =
      message.includes('lock') ||
      message.includes('deadlock') ||
      message.includes('could not obtain');

    if (isLockConflict) {
      return {
        code: 'RESET_LOCK_CONFLICT',
        message:
          'Dataset reset could not complete because the playground is busy with another query.',
        hint: 'Wait for your current SQL experiment to finish, then try reset again.',
      };
    }

    return {
      code: 'RESET_EXECUTION_FAILED',
      message: 'Dataset reset failed while restoring playground tables.',
      hint: 'The playground could not be restored to baseline. Retry reset — partial changes are rolled back automatically.',
    };
  }

  private logReset(
    status: 'started' | 'completed' | 'failed',
    input: ExecuteDatasetResetInput,
    version: string,
    startedAt: string,
    durationMs?: number,
    errorCode?: string,
  ): void {
    this.logger.log({
      event: 'dataset_reset',
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
