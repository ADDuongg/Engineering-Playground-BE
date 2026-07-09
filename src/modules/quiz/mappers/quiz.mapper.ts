import {
  QuizDefinitionResponse,
  QuizOptionPublic,
  QuizQuestionPublic,
  QuizQuestionType,
  QuizResultStatus,
  QuizResultSummaryResponse,
} from '@db-play/types';
import { QuizEntity } from '../entities/quiz.entity';
import { QuizAttemptEntity } from '../entities/quiz-attempt.entity';

export function toQuizDefinition(quiz: QuizEntity): QuizDefinitionResponse {
  const questions = [...(quiz.questions ?? [])]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((question): QuizQuestionPublic => {
      const options = [...(question.options ?? [])]
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map(
          (option): QuizOptionPublic => ({
            id: option.id,
            label: option.label,
            sequenceOrder: option.sequenceOrder,
          }),
        );

      return {
        id: question.id,
        prompt: question.prompt,
        sequenceOrder: question.sequenceOrder,
        questionType: question.questionType as QuizQuestionType,
        options,
      };
    });

  return {
    labSlug: quiz.lab.slug,
    trackSlug: quiz.lab.track.slug,
    title: quiz.title,
    questions,
  };
}

export function selectBestAttempt(
  attempts: QuizAttemptEntity[],
): QuizAttemptEntity | null {
  if (attempts.length === 0) {
    return null;
  }

  return [...attempts].sort((a, b) => {
    if (b.percentCorrect !== a.percentCorrect) {
      return b.percentCorrect - a.percentCorrect;
    }
    return b.attemptedAt.getTime() - a.attemptedAt.getTime();
  })[0];
}

export function toQuizResultSummary(
  labSlug: string,
  attempts: QuizAttemptEntity[],
): QuizResultSummaryResponse {
  const attemptCount = attempts.length;
  if (attemptCount === 0) {
    return {
      labSlug,
      status: 'not_attempted',
      attemptCount: 0,
    };
  }

  const best = selectBestAttempt(attempts)!;
  const passed = attempts.some((attempt) => attempt.passed);
  const status: QuizResultStatus = passed ? 'passed' : 'failed';

  return {
    labSlug,
    status,
    attemptCount,
    correctCount: best.correctCount,
    totalQuestions: best.totalQuestions,
    percentCorrect: best.percentCorrect,
    bestAttemptedAt: best.attemptedAt.toISOString(),
  };
}
