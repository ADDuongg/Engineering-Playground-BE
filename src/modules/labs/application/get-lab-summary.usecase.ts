import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  LabStatus,
  LabSummaryResponse,
  TrackStatus,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { LabSummaryCurriculumRepository } from '../infrastructure/lab-summary-curriculum.repository';
import { LabGuidedStepRepository } from '../infrastructure/lab-guided-step.repository';
import { toLabSummaryResponse } from '../mappers/lab-summary.mapper';

@Injectable()
export class GetLabSummaryUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly curriculumRepository: LabSummaryCurriculumRepository,
    private readonly stepRepository: LabGuidedStepRepository,
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

    if (lab.status !== LabStatus.ACTIVE) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Lab is coming soon and is not available to start yet',
        403,
      );
    }

    const curriculum = await this.curriculumRepository.findByLabId(lab.id);
    if (!curriculum) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab summary for "${labSlug}" was not found.`,
        404,
      );
    }

    const steps = await this.stepRepository.findOrderedByLabId(lab.id);
    const quizExists = await this.quizRepository.existsByLabId(lab.id);
    const quizRequired = curriculum.quizRequired || quizExists;

    return toLabSummaryResponse(lab, curriculum, steps, quizRequired);
  }
}
