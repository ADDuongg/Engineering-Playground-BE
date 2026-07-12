import { Injectable } from '@nestjs/common';
import {
  AdminLabGuidedStepListResponse,
  ErrorCode,
  ReorderLabGuidedStepsRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';

@Injectable()
export class ReorderLabGuidedStepsUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly stepRepository: LabGuidedStepRepository,
  ) {}

  async execute(
    labSlug: string,
    input: ReorderLabGuidedStepsRequest,
  ): Promise<AdminLabGuidedStepListResponse> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const existing = await this.stepRepository.findOrderedByLabId(lab.id);
    const existingIds = new Set(existing.map((s) => s.id));
    const requested = input.stepIds;

    if (requested.length !== existingIds.size) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Reorder must include every guided step id for the lab exactly once',
        400,
        { field: 'stepIds' },
      );
    }

    const seen = new Set<string>();
    for (const id of requested) {
      if (seen.has(id) || !existingIds.has(id)) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'Reorder must include every guided step id for the lab exactly once',
          400,
          { field: 'stepIds' },
        );
      }
      seen.add(id);
    }

    const steps = await this.stepRepository.reorder(lab.id, requested);
    return {
      steps: steps.map((step) => AdminLabFlowMapper.toStepView(step, lab.slug)),
    };
  }
}
