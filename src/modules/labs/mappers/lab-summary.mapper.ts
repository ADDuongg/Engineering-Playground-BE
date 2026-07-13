import {
  GuidedSql,
  LabGuidedStepAction,
  LabGuidedStepPayload,
  LabSummaryResponse,
} from '@db-play/types';
import { LabEntity } from '../../progress/entities/lab.entity';
import { LabSummaryCurriculumEntity } from '../entities/lab-summary-curriculum.entity';
import { LabGuidedStepEntity } from '../entities/lab-guided-step.entity';

function asPayload(
  raw: Record<string, unknown> | null,
): LabGuidedStepPayload | null {
  if (!raw) {
    return null;
  }
  return raw as LabGuidedStepPayload;
}

function cloneGuidedSql(query: GuidedSql): GuidedSql {
  return {
    ...query,
    exampleParameters: [...query.exampleParameters],
    paramHints: [...query.paramHints],
  };
}

function emptyGuidedSql(): GuidedSql {
  return {
    sql: '',
    exampleParameters: [],
    paramHints: [],
    description: '',
  };
}

const QUERY_ACTIONS: LabGuidedStepAction[] = [
  'run_sql',
  'run_explain',
  'run_explain_analyze',
];

/**
 * Top-level SQL fields stay for FE compatibility; prefer step payloads for Apply.
 */
export function deriveTopLevelSql(
  steps: LabGuidedStepEntity[],
  curriculum: LabSummaryCurriculumEntity,
): {
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
} {
  let recommendedQuery: GuidedSql | null = null;
  let recommendedCreateIndexSql: string | null = null;
  let recommendedDropIndexSql: string | null = null;

  for (const step of steps) {
    const payload = asPayload(step.payload);
    if (!payload) {
      continue;
    }

    if (
      !recommendedQuery &&
      QUERY_ACTIONS.includes(step.action) &&
      payload.recommendedQuery?.sql
    ) {
      recommendedQuery = cloneGuidedSql(payload.recommendedQuery);
    }

    if (
      !recommendedCreateIndexSql &&
      step.action === 'create_index_sql' &&
      typeof payload.sql === 'string' &&
      payload.sql.length > 0
    ) {
      recommendedCreateIndexSql = payload.sql;
    }

    if (
      !recommendedDropIndexSql &&
      step.action === 'drop_index_sql' &&
      typeof payload.sql === 'string' &&
      payload.sql.length > 0
    ) {
      recommendedDropIndexSql = payload.sql;
    }
  }

  return {
    recommendedQuery:
      recommendedQuery ??
      (curriculum.recommendedQuery
        ? cloneGuidedSql(curriculum.recommendedQuery)
        : emptyGuidedSql()),
    recommendedCreateIndexSql:
      recommendedCreateIndexSql ?? curriculum.recommendedCreateIndexSql ?? '',
    recommendedDropIndexSql:
      recommendedDropIndexSql ?? curriculum.recommendedDropIndexSql ?? '',
  };
}

export function toLabSummaryResponse(
  lab: LabEntity,
  curriculum: LabSummaryCurriculumEntity,
  steps: LabGuidedStepEntity[],
  quizRequired: boolean,
): LabSummaryResponse {
  const topLevel = deriveTopLevelSql(steps, curriculum);

  return {
    labSlug: lab.slug,
    trackSlug: lab.track.slug,
    title: lab.title,
    learningGoal: curriculum.learningGoal,
    theory: curriculum.theory,
    guidedSteps: steps.map((step) => ({
      order: step.displayOrder,
      title: step.title,
      instruction: step.instruction,
      action: step.action,
      payload: asPayload(step.payload),
    })),
    recommendedQuery: topLevel.recommendedQuery,
    recommendedCreateIndexSql: topLevel.recommendedCreateIndexSql,
    recommendedDropIndexSql: topLevel.recommendedDropIndexSql,
    quizRequired,
    dataset: curriculum.dataset
      ? {
          ...curriculum.dataset,
          recommendedTier: [...curriculum.dataset.recommendedTier],
        }
      : null,
    config: curriculum.config ?? null,
    optionalBenchmarkNote: curriculum.optionalBenchmarkNote ?? null,
  };
}
