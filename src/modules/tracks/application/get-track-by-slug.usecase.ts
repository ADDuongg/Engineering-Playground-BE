import { Injectable } from '@nestjs/common';
import { ErrorCode, TrackDetail } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../infrastructure/track.repository';
import { TrackMapper } from '../mappers/track.mapper';

@Injectable()
export class GetTrackBySlugUseCase {
  constructor(private readonly trackRepository: TrackRepository) {}

  async execute(slug: string): Promise<TrackDetail> {
    const track = await this.trackRepository.findBySlug(slug);

    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${slug}" is not available on this platform.`,
        404,
      );
    }

    return TrackMapper.toDetail(track);
  }
}
