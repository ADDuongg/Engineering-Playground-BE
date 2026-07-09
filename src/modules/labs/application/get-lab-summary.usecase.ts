import { Injectable } from '@nestjs/common';
import { ErrorCode, LabSummaryResponse, TrackStatus } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { LabSummaryRegistry } from '../infrastructure/lab-summary.registry';
import { toLabSummaryResponse } from '../mappers/lab-summary.mapper';

@Injectable()
export class GetLabSummaryUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly labSummaryRegistry: LabSummaryRegistry,
    private readonly quizRepository: QuizRepository,
  ) {}

  async execute(labSlug: string): Promise<LabSummaryResponse> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    if (!lab.track) {
      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        `Lab "${labSlug}" is missing track association.`,
        500,
      );
    }

    if (lab.track.status !== TrackStatus.ACTIVE) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        `Lab "${labSlug}" belongs to a track that is not available for learning yet.`,
        403,
      );
    }

    const content = this.labSummaryRegistry.getByLabSlug(labSlug);
    if (!content) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab summary for "${labSlug}" was not found.`,
        404,
      );
    }

    const quizExists = await this.quizRepository.existsByLabId(lab.id);
    const quizRequired = content.quizRequired || quizExists;

    return toLabSummaryResponse(lab, content, quizRequired);
  }
}
