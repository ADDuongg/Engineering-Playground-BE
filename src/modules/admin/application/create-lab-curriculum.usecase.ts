import { Injectable } from '@nestjs/common';
import {
  AdminLabCurriculumView,
  CreateLabCurriculumRequest,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabSummaryCurriculumRepository } from '../../labs/infrastructure/lab-summary-curriculum.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';

@Injectable()
export class CreateLabCurriculumUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly curriculumRepository: LabSummaryCurriculumRepository,
  ) {}

  async execute(
    labSlug: string,
    input: CreateLabCurriculumRequest,
  ): Promise<AdminLabCurriculumView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const existing = await this.curriculumRepository.findByLabId(lab.id);
    if (existing) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Lab curriculum already exists',
        409,
        { labSlug },
      );
    }

    const curriculum = await this.curriculumRepository.create({
      labId: lab.id,
      learningGoal: input.learningGoal,
      theory: input.theory,
      recommendedQuery: input.recommendedQuery ?? null,
      recommendedCreateIndexSql: input.recommendedCreateIndexSql ?? null,
      recommendedDropIndexSql: input.recommendedDropIndexSql ?? null,
      dataset: input.dataset ?? null,
      config: input.config ?? null,
      quizRequired: input.quizRequired,
      optionalBenchmarkNote: input.optionalBenchmarkNote ?? null,
    });

    return AdminLabFlowMapper.toCurriculumView(curriculum, lab.slug);
  }
}
