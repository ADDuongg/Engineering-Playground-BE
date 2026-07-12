import { Injectable } from '@nestjs/common';
import { AdminLabCurriculumView, ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabSummaryCurriculumRepository } from '../../labs/infrastructure/lab-summary-curriculum.repository';
import { AdminLabFlowMapper } from '../mappers/admin-lab-flow.mapper';

@Injectable()
export class GetLabCurriculumUseCase {
  constructor(
    private readonly labRepository: LabRepository,
    private readonly curriculumRepository: LabSummaryCurriculumRepository,
  ) {}

  async execute(labSlug: string): Promise<AdminLabCurriculumView> {
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

    return AdminLabFlowMapper.toCurriculumView(curriculum, lab.slug);
  }
}
