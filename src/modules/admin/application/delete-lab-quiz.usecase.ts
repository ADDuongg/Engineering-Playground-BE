import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';

/**
 * Hard-deletes the quiz (cascade questions/options/attempts via FK).
 * Does NOT revoke or delete lab completion records.
 */
@Injectable()
export class DeleteLabQuizUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
  ) {}

  async execute(labSlug: string): Promise<void> {
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

    await this.quizRepository.delete(quiz);
  }
}
