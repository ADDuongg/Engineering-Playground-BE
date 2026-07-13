import {
  GuidedSql,
  LabGuidedStepAction,
  LabSummaryDatasetHint,
} from './lab-summary';

export interface AdminLabGuidedStepView {
  id: string;
  labSlug: string;
  displayOrder: number;
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  payload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabGuidedStepRequest {
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  displayOrder: number;
  payload?: Record<string, unknown> | null;
}

export interface UpdateLabGuidedStepRequest {
  title?: string;
  instruction?: string;
  action?: LabGuidedStepAction;
  displayOrder?: number;
  /** `null` clears payload; omit leaves unchanged */
  payload?: Record<string, unknown> | null;
}

export interface ReorderLabGuidedStepsRequest {
  /** Complete ordered list of all step ids for the lab */
  stepIds: string[];
}

export interface AdminLabGuidedStepListResponse {
  steps: AdminLabGuidedStepView[];
}

export interface AdminLabCurriculumView {
  labSlug: string;
  learningGoal: string;
  theory: string;
  /** Database/SQL-only; null for non-SQL tracks. */
  recommendedQuery: GuidedSql | null;
  recommendedCreateIndexSql: string | null;
  recommendedDropIndexSql: string | null;
  /** Database/SQL-only; null for tracks without a playground dataset. */
  dataset: LabSummaryDatasetHint | null;
  /** Optional per-track lab-level metadata. */
  config: Record<string, unknown> | null;
  quizRequired: boolean;
  optionalBenchmarkNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabCurriculumRequest {
  learningGoal: string;
  theory: string;
  /** Database/SQL-only; omit for non-SQL tracks. */
  recommendedQuery?: GuidedSql | null;
  recommendedCreateIndexSql?: string | null;
  recommendedDropIndexSql?: string | null;
  /** Database/SQL-only; omit for tracks without a playground dataset. */
  dataset?: LabSummaryDatasetHint | null;
  /** Optional per-track lab-level metadata. */
  config?: Record<string, unknown> | null;
  quizRequired: boolean;
  optionalBenchmarkNote?: string | null;
}

export interface UpdateLabCurriculumRequest {
  learningGoal?: string;
  theory?: string;
  /** `null` clears; omit leaves unchanged */
  recommendedQuery?: GuidedSql | null;
  recommendedCreateIndexSql?: string | null;
  recommendedDropIndexSql?: string | null;
  dataset?: LabSummaryDatasetHint | null;
  config?: Record<string, unknown> | null;
  quizRequired?: boolean;
  optionalBenchmarkNote?: string | null;
}
