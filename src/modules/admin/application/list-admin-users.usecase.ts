import { Injectable } from '@nestjs/common';
import {
  AdminUserPaginationMeta,
  AdminUserView,
  createSuccessResponse,
  ApiResponse,
} from '@db-play/types';
import { UserRepository } from '../../auth/infrastructure/user.repository';
import { AdminUserMapper } from '../mappers/admin-user.mapper';

@Injectable()
export class ListAdminUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: {
    page?: number;
    limit?: number;
    q?: string;
  }): Promise<ApiResponse<AdminUserView[]>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { users, total } = await this.userRepository.findPaginated({
      page,
      limit,
      q: input.q,
    });

    return createSuccessResponse(
      users.map((user) => AdminUserMapper.toView(user)),
      {
        pagination: { page, limit, total } satisfies AdminUserPaginationMeta,
      },
    );
  }
}
