import { AdminUserView } from '@db-play/types';
import { UserEntity } from '../../auth/entities/user.entity';

export class AdminUserMapper {
  static toView(entity: UserEntity): AdminUserView {
    return {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      role: entity.role,
      updatedBy: entity.updatedBy ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
