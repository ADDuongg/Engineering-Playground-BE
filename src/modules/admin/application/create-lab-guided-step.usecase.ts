import { Injectable } from '@nestjs/common';
import {
  AdminLabGuidedStepView,
  CreateLabGuidedStepRequest,
  ErrorCode,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';
import { assertLabGuidedStepAction } from './lab-guided-step-action.validator';

@Injectable()
export class CreateLabGuidedStepUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly stepRepository: LabGuidedStepRepository,
  ) {}

  async execute(
    labSlug: string,
    input: CreateLabGuidedStepRequest,
  ): Promise<AdminLabGuidedStepView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    assertLabGuidedStepAction(input.action);

    const step = await this.stepRepository.create({
      labId: lab.id,
      displayOrder: input.displayOrder,
      title: input.title,
      instruction: input.instruction,
      action: input.action,
      payload: input.payload ?? null,
    });

    return AdminLabFlowMapper.toStepView(step, lab.slug);
  }
}
