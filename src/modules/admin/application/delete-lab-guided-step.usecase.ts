import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabGuidedStepRepository } from '../../labs/infrastructure/lab-guided-step.repository';

@Injectable()
export class DeleteLabGuidedStepUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly stepRepository: LabGuidedStepRepository,
  ) {}

  async execute(labSlug: string, stepId: string): Promise<void> {
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

    await this.stepRepository.delete(step);
  }
}
