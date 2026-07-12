import { Injectable } from '@nestjs/common';
import {
  AdminQuizOptionView,
  CreateQuizOptionRequest,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';
import { assertValidAnswerKey } from './quiz-answer-key.validator';

@Injectable()
export class CreateQuizOptionUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    questionId: string,
    input: CreateQuizOptionRequest,
  ): Promise<AdminQuizOptionView> {
    const { question } = await this.resolveQuestion(labSlug, questionId);
    const existing = question.options ?? [];

    const projected = input.isCorrect
      ? [
          ...existing.map((option) => ({ ...option, isCorrect: false })),
          { isCorrect: true },
        ]
      : [...existing, { isCorrect: false }];

    assertValidAnswerKey(projected);

    const created = await this.questionRepository.createOption(
      question.id,
      input,
    );
    return AdminQuizMapper.toOptionView(created);
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

    return { lab, quiz, question };
  }
}
