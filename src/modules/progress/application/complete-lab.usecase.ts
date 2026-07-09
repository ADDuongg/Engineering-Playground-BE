import { Injectable, Optional, Inject } from '@nestjs/common';
import { ErrorCode, TrackStatus } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../infrastructure/lab.repository';
import { RecordLabCompletionService } from './record-lab-completion.service';
import { QUIZ_GATE_PORT, QuizGatePort } from './quiz-gate.port';

@Injectable()
export class CompleteLabUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly recordLabCompletionService: RecordLabCompletionService,
    @Optional()
    @Inject(QUIZ_GATE_PORT)
    private readonly quizGate?: QuizGatePort,
  ) {}

  async execute(userId: string, labSlug: string) {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    if (!lab.track) {
      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        `Lab "${labSlug}" is missing track association.`,
        500,
      );
    }

    if (lab.track.status !== TrackStatus.ACTIVE) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        `Lab "${labSlug}" belongs to a track that is not available for learning yet.`,
        403,
      );
    }

    if (this.quizGate) {
      const hasQuiz = await this.quizGate.hasQuizForLab(lab.id);
      if (hasQuiz) {
        const passed = await this.quizGate.hasPassingAttempt(userId, lab.id);
        if (!passed) {
          throw new DomainError(
            ErrorCode.FORBIDDEN,
            `Lab "${labSlug}" requires a passing quiz before it can be marked complete.`,
            403,
          );
        }
      }
    }

    return this.recordLabCompletionService.record(userId, lab);
  }
}
