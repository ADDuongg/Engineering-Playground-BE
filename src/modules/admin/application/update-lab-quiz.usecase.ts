import { Injectable } from '@nestjs/common';
import {
  AdminQuizView,
  ErrorCode,
  UpdateLabQuizRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';

@Injectable()
export class UpdateLabQuizUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
  ) {}

  async execute(
    labSlug: string,
    input: UpdateLabQuizRequest,
  ): Promise<AdminQuizView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const quiz = await this.quizRepository.findAdminByLabId(lab.id);
    if (!quiz) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Quiz for lab "${labSlug}" was not found.`,
        404,
      );
    }

    if (!Object.prototype.hasOwnProperty.call(input, 'title')) {
      return AdminQuizMapper.toQuizView(quiz, lab.slug);
    }

    const updated = await this.quizRepository.updateTitle(
      quiz,
      input.title ?? null,
    );
    return AdminQuizMapper.toQuizView(updated, lab.slug);
  }
}
