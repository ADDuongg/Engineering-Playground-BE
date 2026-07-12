import { Injectable } from '@nestjs/common';
import { AdminLabView, ErrorCode, UpdateLabRequest } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';

@Injectable()
export class UpdateLabUseCase {
  constructor(private readonly labRepository: LabRepository) {}

  async execute(labSlug: string, input: UpdateLabRequest): Promise<AdminLabView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }

    const updated = await this.labRepository.update(lab, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.sequenceOrder !== undefined
        ? { sequenceOrder: input.sequenceOrder }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    return AdminCatalogMapper.toLabView(updated);
  }
}
