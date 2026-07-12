import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { assertValidAnswerKey } from './quiz-answer-key.validator';

@Injectable()
export class DeleteQuizOptionUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    questionId: string,
    optionId: string,
  ): Promise<void> {
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

    const option = (question.options ?? []).find((row) => row.id === optionId);
    if (!option) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Option "${optionId}" was not found for question "${questionId}".`,
        404,
      );
    }

    const remaining = (question.options ?? [])
      .filter((row) => row.id !== optionId)
      .map((row) => ({ isCorrect: row.isCorrect }));

    assertValidAnswerKey(remaining);

    await this.questionRepository.deleteOption(option);
  }
}
