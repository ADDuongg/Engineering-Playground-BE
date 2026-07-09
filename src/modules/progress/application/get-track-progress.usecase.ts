import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  TrackProgressSummaryResponse,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../infrastructure/lab.repository';
import { UserLabCompletionRepository } from '../infrastructure/user-lab-completion.repository';
import { ProgressMapper } from '../mappers/progress.mapper';

@Injectable()
export class GetTrackProgressUseCase {
  constructor(
    private readonly trackRepository: TrackRepository,
    private readonly labRepository: LabRepository,
    private readonly completionRepository: UserLabCompletionRepository,
  ) {}

  async execute(
    userId: string,
    trackSlug: string,
  ): Promise<TrackProgressSummaryResponse> {
    const track = await this.trackRepository.findBySlug(trackSlug);
    if (!track) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Track "${trackSlug}" is not available on this platform.`,
        404,
      );
    }

    const labs = await this.labRepository.findOrderedByTrackId(track.id);
    const completions = await this.completionRepository.listByUserAndTrackId(
      userId,
      track.id,
    );
    const completedLabIds = new Set(completions.map((c) => c.labId));

    const progressLabs = labs.map((lab) =>
      ProgressMapper.toProgressLabItem(lab, completedLabIds.has(lab.id)),
    );
    const completedLabSlugs = progressLabs
      .filter((lab) => lab.completed)
      .map((lab) => lab.slug);

    const totalLabs = labs.length;
    const completedCount = completedLabSlugs.length;
    const percentComplete =
      totalLabs === 0 ? 0 : Math.round((completedCount / totalLabs) * 100);

    return {
      trackSlug: track.slug,
      totalLabs,
      completedCount,
      percentComplete,
      completedLabSlugs,
      labs: progressLabs,
    };
  }
}
