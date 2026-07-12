import { Injectable } from '@nestjs/common';
import { AdminUserView, ErrorCode, Role } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { UserRepository } from '../../auth/infrastructure/user.repository';
import { AdminUserMapper } from '../mappers/admin-user.mapper';

@Injectable()
export class UpdateAdminUserRoleUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    userId: string,
    role: Role,
    actingAdminId: string,
  ): Promise<AdminUserView> {
    if (role !== Role.USER && role !== Role.ADMIN) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'role must be user or admin',
        400,
        { field: 'role' },
      );
    }

    const result = await this.userRepository.updateRoleWithLastAdminGuard({
      userId,
      newRole: role,
      actingAdminId,
    });

    if (result.kind === 'not_found') {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `User "${userId}" was not found.`,
        404,
      );
    }

    if (result.kind === 'last_admin') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Cannot demote the last remaining admin.',
        409,
      );
    }

    return AdminUserMapper.toView(result.user);
  }
}
