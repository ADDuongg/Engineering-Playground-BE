import { Injectable } from '@nestjs/common';
import {
  AdminTrackView,
  CreateTrackRequest,
  ErrorCode,
  TrackStatus,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';
import { TrackConfigValidator } from './track-config.validator';

@Injectable()
export class CreateTrackUseCase {
  constructor(private readonly trackRepository: TrackRepository) {}

  async execute(input: CreateTrackRequest): Promise<AdminTrackView> {
    const existing = await this.trackRepository.findBySlug(input.slug);
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Track slug already exists',
        409,
        { field: 'slug', slug: input.slug },
      );
    }

    const config = TrackConfigValidator.assertAll({
      runtimeAdapterType: input.runtimeAdapterType,
      inputSurfaceType: input.inputSurfaceType,
      metricCatalogId: input.metricCatalogId,
      visualizationKitId: input.visualizationKitId,
    });

    const track = await this.trackRepository.create({
      slug: input.slug,
      name: input.name,
      description: input.description,
      status: input.status ?? TrackStatus.COMING_SOON,
      displayOrder: input.displayOrder ?? 0,
      ...config,
    });

    return AdminCatalogMapper.toTrackView(track);
  }
}
