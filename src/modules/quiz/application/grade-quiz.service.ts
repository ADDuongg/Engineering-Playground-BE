import { SubmitQuizAnswer } from '@db-play/types';
import { QuizEntity } from '../entities/quiz.entity';
import { DomainError } from '../../../common/errors/domain.error';
import { ErrorCode } from '@db-play/types';

export interface GradeQuizResult {
  correctCount: number;
  totalQuestions: number;
  percentCorrect: number;
  passed: boolean;
  incorrectQuestionIds: string[];
  normalizedAnswers: SubmitQuizAnswer[];
}

export function gradeSingleSelectQuiz(
  quiz: QuizEntity,
  answers: SubmitQuizAnswer[],
): GradeQuizResult {
  const questions = [...(quiz.questions ?? [])].sort(
    (a, b) => a.sequenceOrder - b.sequenceOrder,
  );
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'Quiz has no questions configured and cannot be submitted.',
      400,
    );
  }

  if (answers.length !== totalQuestions) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Expected answers for ${totalQuestions} questions, received ${answers.length}.`,
      400,
    );
  }

  const seenQuestionIds = new Set<string>();
  for (const answer of answers) {
    if (seenQuestionIds.has(answer.questionId)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Duplicate answer for question "${answer.questionId}".`,
        400,
      );
    }
    seenQuestionIds.add(answer.questionId);
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));
  let correctCount = 0;
  const incorrectQuestionIds: string[] = [];

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Unknown question id "${answer.questionId}".`,
        400,
      );
    }

    const option = (question.options ?? []).find(
      (o) => o.id === answer.optionId,
    );
    if (!option) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Option "${answer.optionId}" does not belong to question "${answer.questionId}".`,
        400,
      );
    }

    if (option.isCorrect) {
      correctCount += 1;
    } else {
      incorrectQuestionIds.push(question.id);
    }
  }

  for (const question of questions) {
    if (!seenQuestionIds.has(question.id)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        `Missing answer for question "${question.id}".`,
        400,
      );
    }
  }

  const percentCorrect = Math.round((correctCount / totalQuestions) * 100);
  const passed = correctCount === totalQuestions;

  return {
    correctCount,
    totalQuestions,
    percentCorrect,
    passed,
    incorrectQuestionIds,
    normalizedAnswers: answers,
  };
}
