import { QuizQuestionType } from './quiz-responses';

export interface AdminQuizOptionView {
  id: string;
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
  createdAt: string;
}

export interface AdminQuizQuestionView {
  id: string;
  prompt: string;
  questionType: QuizQuestionType;
  sequenceOrder: number;
  options: AdminQuizOptionView[];
  createdAt: string;
}

export interface AdminQuizView {
  id: string;
  labSlug: string;
  title: string | null;
  questions: AdminQuizQuestionView[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabQuizRequest {
  title?: string | null;
}

export interface UpdateLabQuizRequest {
  /** `null` clears title; omit leaves unchanged */
  title?: string | null;
}

export interface CreateQuizOptionInline {
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
}

export interface CreateQuizQuestionRequest {
  prompt: string;
  sequenceOrder: number;
  /** Defaults to `single_select` when omitted */
  questionType?: QuizQuestionType;
  /** ≥2 options with exactly one `isCorrect: true` */
  options: CreateQuizOptionInline[];
}

export interface UpdateQuizQuestionRequest {
  prompt?: string;
  sequenceOrder?: number;
}

export interface CreateQuizOptionRequest {
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
}

export interface UpdateQuizOptionRequest {
  label?: string;
  sequenceOrder?: number;
  isCorrect?: boolean;
}

export interface ReorderQuizQuestionsRequest {
  /** Complete ordered list of all question ids for the quiz */
  questionIds: string[];
}

export interface ReorderQuizOptionsRequest {
  /** Complete ordered list of all option ids for the question */
  optionIds: string[];
}

export interface AdminQuizQuestionListResponse {
  questions: AdminQuizQuestionView[];
}

export interface AdminQuizOptionListResponse {
  options: AdminQuizOptionView[];
}
