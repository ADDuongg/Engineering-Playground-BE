import { Injectable } from '@nestjs/common';
import {
  AdminLabView,
  CreateLabRequest,
  ErrorCode,
  LabStatus,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';

@Injectable()
export class CreateLabUseCase {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly labRepository: LabRepository,
  ) {}

  async execute(
    trackSlug: string,
    input: CreateLabRequest,
  ): Promise<AdminLabView> {
    const track = await this.trackRepository.findBySlug(trackSlug);
    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${trackSlug}" was not found.`,
        404,
      );
    }

    const existing = await this.labRepository.findBySlug(input.slug);
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Lab slug already exists',
        409,
        { field: 'slug', slug: input.slug },
      );
    }

    const lab = await this.labRepository.create({
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      trackId: track.id,
      sequenceOrder: input.sequenceOrder,
      status: input.status ?? LabStatus.COMING_SOON,
    });

    return AdminCatalogMapper.toLabView(lab);
  }
}
