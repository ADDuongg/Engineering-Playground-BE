import { Injectable } from '@nestjs/common';
import { AdminUserView, ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { UserRepository } from '../../auth/infrastructure/user.repository';
import { AdminUserMapper } from '../mappers/admin-user.mapper';

@Injectable()
export class GetAdminUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<AdminUserView> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `User "${userId}" was not found.`,
        404,
      );
    }
    return AdminUserMapper.toView(user);
  }
}
