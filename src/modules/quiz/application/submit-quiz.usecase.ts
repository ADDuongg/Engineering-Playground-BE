import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ErrorCode,
  LabStatus,
  QUIZ_COMPLETED_EVENT,
  QuizCompletedEvent,
  SubmitQuizAnswer,
  SubmitQuizResult,
  TrackStatus,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { RecordLabCompletionService } from '../../progress/application/record-lab-completion.service';
import { QuizRepository } from '../infrastructure/quiz.repository';
import { QuizAttemptRepository } from '../infrastructure/quiz-attempt.repository';
import { gradeSingleSelectQuiz } from './grade-quiz.service';

@Injectable()
export class SubmitQuizUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly quizRepository: QuizRepository,
    private readonly quizAttemptRepository: QuizAttemptRepository,
    private readonly recordLabCompletionService: RecordLabCompletionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    userId: string,
    labSlug: string,
    answers: SubmitQuizAnswer[],
  ): Promise<SubmitQuizResult> {
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

    if (lab.status !== LabStatus.ACTIVE) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Lab is coming soon and is not available to start yet',
        403,
      );
    }

    const quiz = await this.quizRepository.findByLabSlug(labSlug);
    if (!quiz) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Quiz for lab "${labSlug}" was not found.`,
        404,
      );
    }

    const grade = gradeSingleSelectQuiz(quiz, answers);
    const attemptedAt = new Date();

    await this.quizAttemptRepository.insert({
      userId,
      quizId: quiz.id,
      correctCount: grade.correctCount,
      totalQuestions: grade.totalQuestions,
      percentCorrect: grade.percentCorrect,
      passed: grade.passed,
      answersJson: grade.normalizedAnswers,
      attemptedAt,
    });

    let labCompleted = false;
    let alreadyLabCompleted = false;

    if (grade.passed) {
      const event: QuizCompletedEvent = {
        userId,
        labSlug: lab.slug,
        trackSlug: lab.track.slug,
        correctCount: grade.correctCount,
        totalQuestions: grade.totalQuestions,
        percentCorrect: grade.percentCorrect,
        passed: true,
        attemptedAt: attemptedAt.toISOString(),
      };
      this.eventEmitter.emit(QUIZ_COMPLETED_EVENT, event);

      const completion = await this.recordLabCompletionService.record(
        userId,
        lab,
      );
      alreadyLabCompleted = completion.alreadyCompleted;
      labCompleted = true;
    }

    return {
      labSlug: lab.slug,
      trackSlug: lab.track.slug,
      correctCount: grade.correctCount,
      totalQuestions: grade.totalQuestions,
      percentCorrect: grade.percentCorrect,
      passed: grade.passed,
      attemptedAt: attemptedAt.toISOString(),
      incorrectQuestionIds: grade.incorrectQuestionIds,
      labCompleted,
      alreadyLabCompleted,
    };
  }
}
