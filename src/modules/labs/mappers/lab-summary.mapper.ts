import { LabSummaryResponse } from '@db-play/types';
import { LabEntity } from '../../progress/entities/lab.entity';
import { LabSummaryContent } from '../infrastructure/lab-summary.content';

export function toLabSummaryResponse(
  lab: LabEntity,
  content: LabSummaryContent,
  quizRequired: boolean,
): LabSummaryResponse {
  return {
    labSlug: lab.slug,
    trackSlug: lab.track.slug,
    title: lab.title,
    learningGoal: content.learningGoal,
    theory: content.theory,
    guidedSteps: [...content.guidedSteps].sort((a, b) => a.order - b.order),
    recommendedQuery: {
      ...content.recommendedQuery,
      exampleParameters: [...content.recommendedQuery.exampleParameters],
      paramHints: [...content.recommendedQuery.paramHints],
    },
    recommendedCreateIndexSql: content.recommendedCreateIndexSql,
    recommendedDropIndexSql: content.recommendedDropIndexSql,
    quizRequired,
    dataset: { ...content.dataset },
    optionalBenchmarkNote: content.optionalBenchmarkNote ?? null,
  };
}
