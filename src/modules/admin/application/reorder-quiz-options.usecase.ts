import { Injectable } from '@nestjs/common';
import {
  AdminQuizOptionListResponse,
  ErrorCode,
  ReorderQuizOptionsRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';

@Injectable()
export class ReorderQuizOptionsUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    questionId: string,
    input: ReorderQuizOptionsRequest,
  ): Promise<AdminQuizOptionListResponse> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const quiz = await this.quizRepository.findByLabId(lab.id);
    if (!quiz) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Quiz for lab "${labSlug}" was not found.`,
        404,
      );
    }

    const question = await this.questionRepository.findByIdAndQuizId(
      questionId,
      quiz.id,
    );
    if (!question) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Question "${questionId}" was not found for lab "${labSlug}".`,
        404,
      );
    }

    const existing = question.options ?? [];
    const existingIds = new Set(existing.map((o) => o.id));
    const requested = input.optionIds;

    if (requested.length !== existingIds.size) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Reorder must include every option id for the question exactly once',
        400,
        { field: 'optionIds' },
      );
    }

    const seen = new Set<string>();
    for (const id of requested) {
      if (seen.has(id) || !existingIds.has(id)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Reorder must include every option id for the question exactly once',
          400,
          { field: 'optionIds' },
        );
      }
      seen.add(id);
    }

    const options = await this.questionRepository.reorderOptions(
      question.id,
      requested,
    );

    return {
      options: options.map((option) => AdminQuizMapper.toOptionView(option)),
    };
  }
}
