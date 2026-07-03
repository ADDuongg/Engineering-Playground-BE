import { UserEntity } from '../entities/user.entity';
import { UserProfile } from '@db-play/types';

export class UserMapper {
  static toProfile(user: UserEntity): UserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
