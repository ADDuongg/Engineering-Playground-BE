import { Injectable } from '@nestjs/common';
import { AdminTrackView, ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';

@Injectable()
export class GetAdminTrackUseCase {
  constructor(private readonly trackRepository: TrackRepository) {}

  async execute(slug: string): Promise<AdminTrackView> {
    const track = await this.trackRepository.findBySlug(slug);
    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${slug}" was not found.`,
        404,
      );
    }
    return AdminCatalogMapper.toTrackView(track);
  }
}
