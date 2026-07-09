import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DatasetPreparationStatus,
  DatasetReadinessStatus,
  DatasetTier,
  ErrorCode,
  ExperimentSessionStatus,
  JobStatus,
  JobType,
  RateLimitOperation,
  ResetDatasetInput,
  ResetDatasetResult,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';
import { EnqueueJobService } from '../../worker-queue/application/enqueue-job.service';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';
import { RateLimitService } from '../../rate-limit/application/rate-limit.service';

export interface DatasetResetJobBody {
  family: string;
  tier: DatasetTier;
  version: string;
  sessionId?: string;
  schemaName?: string;
  context?: ResetDatasetInput['context'];
}

@Injectable()
export class ResetDatasetUseCase {
  private readonly logger = new Logger(ResetDatasetUseCase.name);

  constructor(
    private readonly manifestRepository: DatasetManifestRepository,
    private readonly statusStore: DatasetPreparationStatusStore,
    private readonly configService: ConfigService,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
    private readonly rateLimitService: RateLimitService,
    private readonly enqueueJobService: EnqueueJobService,
  ) {}

  async execute(input: ResetDatasetInput): Promise<ResetDatasetResult> {
    const schemaName = await this.resolveSchemaName(input.sessionId);
    const version =
      input.version ?? this.manifestRepository.getDefaultVersion();
    const identity = this.manifestRepository.resolveIdentity(
      input.family,
      input.tier,
      version,
    );

    await this.rateLimitService.consumeQuota({
      operation: RateLimitOperation.DATASET_RESET,
      userId: input.context?.userId,
      sessionId: input.sessionId,
    });

    const body: DatasetResetJobBody = {
      family: identity.family.id,
      tier: input.tier,
      version: identity.version.id,
      sessionId: input.sessionId,
      schemaName,
      context: input.context,
    };

    const { job } = await this.enqueueJobService.enqueue({
      jobType: JobType.DATASET_RESET,
      userId: input.context?.userId ?? null,
      sessionId: input.sessionId ?? null,
      body,
      payloadSummary: {
        family: identity.family.id,
        version: identity.version.id,
        tier: input.tier,
      },
    });

    this.logger.log({
      event: 'dataset_reset_enqueued',
      jobId: job.id,
      family: identity.family.id,
      version: identity.version.id,
      tier: input.tier,
      sessionId: input.sessionId,
      requestId: input.context?.requestId,
      labSlug: input.context?.labSlug,
    });

    return {
      jobId: job.id,
      jobType: 'dataset-reset',
      status: JobStatus.QUEUED,
      createdAt: job.createdAt,
      family: identity.family.id,
      version: identity.version.id,
      tier: input.tier,
    };
  }

  /**
   * @deprecated Prefer GET /jobs/:jobId for foundation-managed reset jobs.
   * Kept for backward compatibility with DatasetPreparationStatusStore polling.
   */
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

    if (this.isInFlightStatus(status.status)) {
      if (this.isOrphanedOperation(status)) {
        return {
          ...status,
          status: DatasetReadinessStatus.FAILED,
          error: {
            code: 'RESET_STALE',
            message:
              'Dataset reset did not complete. The previous attempt may have been interrupted.',
            hint: 'Submit reset again to restore the baseline dataset.',
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
        'Experiment session is not ready for dataset reset.',
        422,
        {
          reason: 'SESSION_NOT_READY',
          status: session.status,
          hint: 'Wait for the experiment session to finish provisioning before resetting the dataset.',
        },
      );
    }

    return session.schemaName;
  }

  private isInFlightStatus(status: DatasetReadinessStatus): boolean {
    return (
      status === DatasetReadinessStatus.PREPARING ||
      status === DatasetReadinessStatus.RESETTING
    );
  }

  private isOrphanedOperation(status: DatasetPreparationStatus): boolean {
    if (!status.startedAt) {
      return true;
    }

    const staleMs = this.configService.get<number>(
      'dataset.preparationStaleMs',
      300_000,
    );

    return Date.now() - new Date(status.startedAt).getTime() > staleMs;
  }
}
