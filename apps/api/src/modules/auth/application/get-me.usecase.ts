import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { UserRepository } from '../infrastructure/user.repository';
import { UserMapper } from '../mappers/user.mapper';
import { UserProfile } from '@db-play/types';

@Injectable()
export class GetMeUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'User not found', 404);
    }

    return UserMapper.toProfile(user);
  }
}
