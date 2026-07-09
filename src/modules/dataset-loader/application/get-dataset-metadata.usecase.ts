import { Injectable } from '@nestjs/common';
import {
  DatasetMetadata,
  DatasetReadinessStatus,
  DatasetTier,
} from '@db-play/types';
import { DatasetManifestRepository } from '../infrastructure/dataset-manifest.repository';
import { DatasetSeedRunner } from '../infrastructure/dataset-seed.runner';
import { DatasetPreparationStatusStore } from '../infrastructure/dataset-preparation-status.store';
import { GetExperimentSessionUseCase } from '../../experiment-isolation/application/get-experiment-session.usecase';

@Injectable()
export class GetDatasetMetadataUseCase {
  constructor(
    private readonly manifestRepository: DatasetManifestRepository,
    private readonly seedRunner: DatasetSeedRunner,
    private readonly statusStore: DatasetPreparationStatusStore,
    private readonly getExperimentSession: GetExperimentSessionUseCase,
  ) {}

  async execute(
    familyId: string,
    tier: DatasetTier,
    version?: string,
    sessionId?: string,
  ): Promise<DatasetMetadata> {
    const schemaName = await this.resolveSchemaName(sessionId);
    const resolvedVersion =
      version ?? this.manifestRepository.getDefaultVersion();
    const identity = this.manifestRepository.resolveIdentity(
      familyId,
      tier,
      resolvedVersion,
    );
    const status = await this.statusStore.getOrDefault(
      identity.family.id,
      identity.version.id,
      tier,
      sessionId,
    );

    const tables = await Promise.all(
      identity.tier.tables.map(async (table) => ({
        name: table.name,
        label: table.label,
        description: table.description,
        targetRowCount: table.targetRowCount,
        actualRowCount:
          status.status === DatasetReadinessStatus.READY
            ? await this.seedRunner.countTableRows(table.name, schemaName)
            : null,
      })),
    );

    return {
      family: identity.family.id,
      familyLabel: identity.family.label,
      version: identity.version.id,
      tier,
      status: status.status,
      tables,
    };
  }

  private async resolveSchemaName(
    sessionId?: string,
  ): Promise<string | undefined> {
    if (!sessionId) {
      return undefined;
    }

    const session = await this.getExperimentSession.execute(sessionId);
    return session.schemaName;
  }
}
