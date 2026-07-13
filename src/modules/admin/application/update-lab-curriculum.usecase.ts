import { Injectable } from '@nestjs/common';
import {
  AdminLabCurriculumView,
  ErrorCode,
  UpdateLabCurriculumRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabSummaryCurriculumRepository } from '../../labs/infrastructure/lab-summary-curriculum.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';

@Injectable()
export class UpdateLabCurriculumUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly curriculumRepository: LabSummaryCurriculumRepository,
  ) {}

  async execute(
    labSlug: string,
    input: UpdateLabCurriculumRequest,
  ): Promise<AdminLabCurriculumView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const curriculum = await this.curriculumRepository.findByLabId(lab.id);
    if (!curriculum) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Curriculum for lab "${labSlug}" was not found.`,
        404,
      );
    }

    const patch: Record<string, unknown> = {};
    if (input.learningGoal !== undefined) {
      if (input.learningGoal === null) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'learningGoal cannot be null',
          400,
          { field: 'learningGoal' },
        );
      }
      patch.learningGoal = input.learningGoal;
    }
    if (input.theory !== undefined) {
      if (input.theory === null) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'theory cannot be null',
          400,
          { field: 'theory' },
        );
      }
      patch.theory = input.theory;
    }
    if (input.recommendedQuery !== undefined) {
      patch.recommendedQuery = input.recommendedQuery;
    }
    if (input.recommendedCreateIndexSql !== undefined) {
      patch.recommendedCreateIndexSql = input.recommendedCreateIndexSql;
    }
    if (input.recommendedDropIndexSql !== undefined) {
      patch.recommendedDropIndexSql = input.recommendedDropIndexSql;
    }
    if (input.dataset !== undefined) {
      patch.dataset = input.dataset;
    }
    if (input.config !== undefined) {
      patch.config = input.config;
    }
    if (input.quizRequired !== undefined) {
      patch.quizRequired = input.quizRequired;
    }
    if (input.optionalBenchmarkNote !== undefined) {
      patch.optionalBenchmarkNote = input.optionalBenchmarkNote;
    }

    const updated = await this.curriculumRepository.update(
      curriculum,
      patch as Parameters<LabSummaryCurriculumRepository['update']>[1],
    );

    return AdminLabFlowMapper.toCurriculumView(updated, lab.slug);
  }
}
