import { Injectable } from '@nestjs/common';
import { TrackListResponse } from '@db-play/types';
import { TrackRepository } from '../infrastructure/track.repository';
import { TrackMapper } from '../mappers/track.mapper';

@Injectable()
export class ListTracksUseCase {
  constructor(private readonly trackRepository: TrackRepository) {}

  async execute(): Promise<TrackListResponse> {
    const tracks = await this.trackRepository.findAllOrdered();

    return {
      tracks: tracks.map(TrackMapper.toSummary),
    };
  }
}
