export type QuizQuestionType = 'single_select';

export interface QuizOptionPublic {
  id: string;
  label: string;
  sequenceOrder: number;
}

export interface QuizQuestionPublic {
  id: string;
  prompt: string;
  sequenceOrder: number;
  questionType: QuizQuestionType;
  options: QuizOptionPublic[];
}

export interface QuizDefinitionResponse {
  labSlug: string;
  trackSlug: string;
  title: string | null;
  questions: QuizQuestionPublic[];
}

export interface SubmitQuizAnswer {
  questionId: string;
  optionId: string;
}

export interface SubmitQuizRequest {
  answers: SubmitQuizAnswer[];
}

export interface SubmitQuizResult {
  labSlug: string;
  trackSlug: string;
  correctCount: number;
  totalQuestions: number;
  percentCorrect: number;
  passed: boolean;
  attemptedAt: string;
  incorrectQuestionIds: string[];
  labCompleted: boolean;
  alreadyLabCompleted: boolean;
}

export type QuizResultStatus = 'not_attempted' | 'failed' | 'passed';

export interface QuizResultSummaryResponse {
  labSlug: string;
  status: QuizResultStatus;
  attemptCount: number;
  correctCount?: number;
  totalQuestions?: number;
  percentCorrect?: number;
  bestAttemptedAt?: string;
}
