import { Injectable } from '@nestjs/common';
import {
  AdminLabGuidedStepView,
  ErrorCode,
  UpdateLabGuidedStepRequest,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';
import { assertLabGuidedStepAction } from './lab-guided-step-action.validator';

@Injectable()
export class UpdateLabGuidedStepUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly stepRepository: LabGuidedStepRepository,
  ) {}

  async execute(
    labSlug: string,
    stepId: string,
    input: UpdateLabGuidedStepRequest,
  ): Promise<AdminLabGuidedStepView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const step = await this.stepRepository.findByIdAndLabId(stepId, lab.id);
    if (!step) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Guided step "${stepId}" was not found for lab "${labSlug}".`,
        404,
      );
    }

    if (input.action !== undefined) {
      assertLabGuidedStepAction(input.action);
    }

    const updated = await this.stepRepository.update(step, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.instruction !== undefined
        ? { instruction: input.instruction }
        : {}),
      ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    });

    return AdminLabFlowMapper.toStepView(updated, lab.slug);
  }
}
