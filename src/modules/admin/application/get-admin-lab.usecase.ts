import { Injectable } from '@nestjs/common';
import { AdminLabView, ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { AdminCatalogMapper } from '../mappers/admin-catalog.mapper';

@Injectable()
export class GetAdminLabUseCase {
  constructor(private readonly labRepository: LabRepository) {}

  async execute(labSlug: string): Promise<AdminLabView> {
    const lab = await this.labRepository.findBySlug(labSlug);
    if (!lab) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `Lab "${labSlug}" was not found.`,
        404,
      );
    }
    return AdminCatalogMapper.toLabView(lab);
  }
}
