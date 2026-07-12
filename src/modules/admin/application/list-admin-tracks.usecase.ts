import { Injectable } from '@nestjs/common';
import { AdminTrackListResponse } from '@db-play/types';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';

@Injectable()
export class ListAdminTracksUseCase {
  constructor(private readonly trackRepository: TrackRepository) {}

  async execute(): Promise<AdminTrackListResponse> {
    const tracks = await this.trackRepository.findAllOrdered();
    return {
      tracks: tracks.map((track) => AdminCatalogMapper.toTrackView(track)),
    };
  }
}
