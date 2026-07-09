export const QUIZ_COMPLETED_EVENT = 'quiz.completed';

export interface QuizCompletedEvent {
  userId: string;
  labSlug: string;
  trackSlug: string;
  correctCount: number;
  totalQuestions: number;
  percentCorrect: number;
  passed: true;
  attemptedAt: string;
}
