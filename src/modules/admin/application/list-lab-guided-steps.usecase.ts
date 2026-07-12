import { Injectable } from '@nestjs/common';
import {
  AdminLabGuidedStepListResponse,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';

@Injectable()
export class ListLabGuidedStepsUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly stepRepository: LabGuidedStepRepository,
  ) {}

  async execute(labSlug: string): Promise<AdminLabGuidedStepListResponse> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const steps = await this.stepRepository.findOrderedByLabId(lab.id);
    return {
      steps: steps.map((step) => AdminLabFlowMapper.toStepView(step, lab.slug)),
    };
  }
}
