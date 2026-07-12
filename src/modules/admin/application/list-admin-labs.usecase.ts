import { Injectable } from '@nestjs/common';
import { AdminLabListResponse, ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';

@Injectable()
export class ListAdminLabsUseCase {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly labRepository: LabRepository,
  ) {}

  async execute(trackSlug: string): Promise<AdminLabListResponse> {
    const track = await this.trackRepository.findBySlug(trackSlug);
    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${trackSlug}" was not found.`,
        404,
      );
    }

    const labs = await this.labRepository.findOrderedByTrackId(track.id);
    return {
      labs: labs.map((lab) => AdminCatalogMapper.toLabView(lab)),
    };
  }
}
