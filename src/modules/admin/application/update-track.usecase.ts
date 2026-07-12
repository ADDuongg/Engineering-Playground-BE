import { Injectable } from '@nestjs/common';
import {
  AdminTrackView,
  ErrorCode,
  UpdateTrackRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';
import { TrackConfigValidator } from './track-config.validator';

@Injectable()
export class UpdateTrackUseCase {
  constructor(private readonly trackRepository: TrackRepository) {}

  async execute(
    slug: string,
    input: UpdateTrackRequest,
  ): Promise<AdminTrackView> {
    const track = await this.trackRepository.findBySlug(slug);
    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${slug}" was not found.`,
        404,
      );
    }

    if (input.runtimeAdapterType !== undefined) {
      TrackConfigValidator.assertRuntimeAdapterType(input.runtimeAdapterType);
    }
    if (input.inputSurfaceType !== undefined) {
      TrackConfigValidator.assertInputSurfaceType(input.inputSurfaceType);
    }
    if (input.metricCatalogId !== undefined) {
      TrackConfigValidator.assertMetricCatalogId(input.metricCatalogId);
    }
    if (input.visualizationKitId !== undefined) {
      TrackConfigValidator.assertVisualizationKitId(input.visualizationKitId);
    }

    const updated = await this.trackRepository.update(track, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(input.runtimeAdapterType !== undefined
        ? { runtimeAdapterType: input.runtimeAdapterType }
        : {}),
      ...(input.inputSurfaceType !== undefined
        ? { inputSurfaceType: input.inputSurfaceType }
        : {}),
      ...(input.metricCatalogId !== undefined
        ? { metricCatalogId: input.metricCatalogId }
        : {}),
      ...(input.visualizationKitId !== undefined
        ? { visualizationKitId: input.visualizationKitId }
        : {}),
    });

    return AdminCatalogMapper.toTrackView(updated);
  }
}
