import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  QuizResultSummaryResponse,
  TrackStatus,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../infrastructure/quiz.repository';
import { QuizAttemptRepository } from '../infrastructure/quiz-attempt.repository';
import { toQuizResultSummary } from '../mappers/quiz.mapper';

@Injectable()
export class GetQuizResultUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly quizAttemptRepository: QuizAttemptRepository,
  ) {}

  async execute(
    userId: string,
    labSlug: string,
  ): Promise<QuizResultSummaryResponse> {
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

    const quiz = await this.quizRepository.findByLabSlug(labSlug);
    if (!quiz) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Quiz for lab "${labSlug}" was not found.`,
        404,
      );
    }

    const attempts = await this.quizAttemptRepository.listByUserAndQuiz(
      userId,
      quiz.id,
    );

    return toQuizResultSummary(labSlug, attempts);
  }
}
