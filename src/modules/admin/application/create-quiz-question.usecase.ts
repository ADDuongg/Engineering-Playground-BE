import { Injectable } from '@nestjs/common';
import {
  AdminQuizQuestionView,
  CreateQuizQuestionRequest,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';
import { assertValidAnswerKey } from './quiz-answer-key.validator';

@Injectable()
export class CreateQuizQuestionUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    input: CreateQuizQuestionRequest,
  ): Promise<AdminQuizQuestionView> {
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

    const questionType = input.questionType ?? 'single_select';
    if (questionType !== 'single_select') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Only single_select questions are supported.',
        400,
        { field: 'questionType' },
      );
    }

    assertValidAnswerKey(input.options);

    const question = await this.questionRepository.createWithOptions({
      quizId: quiz.id,
      prompt: input.prompt,
      questionType,
      sequenceOrder: input.sequenceOrder,
      options: input.options,
    });

    return AdminQuizMapper.toQuestionView(question);
  }
}
