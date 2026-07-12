import { Injectable } from '@nestjs/common';
import {
  AdminQuizQuestionView,
  ErrorCode,
  UpdateQuizQuestionRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { QuizQuestionRepository } from '../../quiz/infrastructure/quiz-question.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';

@Injectable()
export class UpdateQuizQuestionUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly questionRepository: QuizQuestionRepository,
  ) {}

  async execute(
    labSlug: string,
    questionId: string,
    input: UpdateQuizQuestionRequest,
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

    const updated = await this.questionRepository.updatePromptAndOrder(
      question,
      {
        prompt: input.prompt,
        sequenceOrder: input.sequenceOrder,
      },
    );

    return AdminQuizMapper.toQuestionView(updated);
  }
}
