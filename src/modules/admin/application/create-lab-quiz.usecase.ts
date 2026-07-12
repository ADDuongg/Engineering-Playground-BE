import { Injectable } from '@nestjs/common';
import {
  AdminQuizView,
  CreateLabQuizRequest,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { AdminQuizMapper } from '../mappers/admin-quiz.mapper';

@Injectable()
export class CreateLabQuizUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
  ) {}

  async execute(
    labSlug: string,
    input: CreateLabQuizRequest,
  ): Promise<AdminQuizView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    if (await this.quizRepository.existsByLabId(lab.id)) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Quiz for lab "${labSlug}" already exists.`,
        409,
      );
    }

    const quiz = await this.quizRepository.create({
      labId: lab.id,
      title: input.title ?? null,
    });

    return AdminQuizMapper.toQuizView(quiz, lab.slug);
  }
}
