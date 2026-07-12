import {
  AdminLabCurriculumView,
  AdminLabGuidedStepView,
} from '@db-play/types';
import { LabGuidedStepEntity } from '../../labs/entities/lab-guided-step.entity';
import { LabSummaryCurriculumEntity } from '../../labs/entities/lab-summary-curriculum.entity';

export class AdminLabFlowMapper {
  static toStepView(
    entity: LabGuidedStepEntity,
    labSlug: string,
  ): AdminLabGuidedStepView {
    return {
      id: entity.id,
      labSlug,
      displayOrder: entity.displayOrder,
      title: entity.title,
      instruction: entity.instruction,
      action: entity.action,
      payload: entity.payload,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toCurriculumView(
    entity: LabSummaryCurriculumEntity,
    labSlug: string,
  ): AdminLabCurriculumView {
    return {
      labSlug,
      learningGoal: entity.learningGoal,
      theory: entity.theory,
      recommendedQuery: {
        ...entity.recommendedQuery,
        exampleParameters: [...entity.recommendedQuery.exampleParameters],
        paramHints: [...entity.recommendedQuery.paramHints],
      },
      recommendedCreateIndexSql: entity.recommendedCreateIndexSql,
      recommendedDropIndexSql: entity.recommendedDropIndexSql,
      dataset: {
        ...entity.dataset,
        recommendedTier: [...entity.dataset.recommendedTier],
      },
      quizRequired: entity.quizRequired,
      optionalBenchmarkNote: entity.optionalBenchmarkNote,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
