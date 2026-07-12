import { Injectable } from '@nestjs/common';
import {
  AdminQuizQuestionListResponse,
  ErrorCode,
  ReorderQuizQuestionsRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';

@Injectable()
export class ReorderQuizQuestionsUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    input: ReorderQuizQuestionsRequest,
  ): Promise<AdminQuizQuestionListResponse> {
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

    const existing = await this.questionRepository.findOrderedByQuizId(quiz.id);
    const existingIds = new Set(existing.map((q) => q.id));
    const requested = input.questionIds;

    if (requested.length !== existingIds.size) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Reorder must include every question id for the quiz exactly once',
        400,
        { field: 'questionIds' },
      );
    }

    const seen = new Set<string>();
    for (const id of requested) {
      if (seen.has(id) || !existingIds.has(id)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Reorder must include every question id for the quiz exactly once',
          400,
          { field: 'questionIds' },
        );
      }
      seen.add(id);
    }

    const questions = await this.questionRepository.reorderQuestions(
      quiz.id,
      requested,
    );

    return {
      questions: questions.map((question) =>
        AdminQuizMapper.toQuestionView(question),
      ),
    };
  }
}
