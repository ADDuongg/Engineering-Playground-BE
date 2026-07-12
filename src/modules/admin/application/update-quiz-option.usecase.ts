import { Injectable } from '@nestjs/common';
import {
  AdminQuizOptionView,
  ErrorCode,
  UpdateQuizOptionRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';
import { assertValidAnswerKey } from './quiz-answer-key.validator';

@Injectable()
export class UpdateQuizOptionUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    questionId: string,
    optionId: string,
    input: UpdateQuizOptionRequest,
  ): Promise<AdminQuizOptionView> {
    const { question } = await this.resolveQuestion(labSlug, questionId);
    const option = (question.options ?? []).find((row) => row.id === optionId);
    if (!option) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Option "${optionId}" was not found for question "${questionId}".`,
        404,
      );
    }

    const nextIsCorrect =
      input.isCorrect !== undefined ? input.isCorrect : option.isCorrect;

    const projected = (question.options ?? []).map((row) => {
      if (row.id === optionId) {
        return { isCorrect: nextIsCorrect };
      }
      if (nextIsCorrect === true) {
        return { isCorrect: false };
      }
      return { isCorrect: row.isCorrect };
    });

    assertValidAnswerKey(projected);

    const updated = await this.questionRepository.updateOption(option, {
      label: input.label,
      sequenceOrder: input.sequenceOrder,
      isCorrect: input.isCorrect,
    });

    return AdminQuizMapper.toOptionView(updated);
  }

  private async resolveQuestion(labSlug: string, questionId: string) {
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

    return { question };
  }
}
