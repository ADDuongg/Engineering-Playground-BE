import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  TrackLearningPathResponse,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../infrastructure/lab.repository';
import { ProgressMapper } from '../mappers/progress.mapper';

@Injectable()
export class GetLearningPathUseCase {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly labRepository: LabRepository,
  ) {}

  async execute(trackSlug: string): Promise<TrackLearningPathResponse> {
    const track = await this.trackRepository.findBySlug(trackSlug);
    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${trackSlug}" is not available on this platform.`,
        404,
      );
    }

    const labs = await this.labRepository.findOrderedByTrackId(track.id);

    return {
      trackSlug: track.slug,
      labs: labs.map((lab) => ProgressMapper.toPathItem(lab)),
    };
  }
}
