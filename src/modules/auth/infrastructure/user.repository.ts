import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '@db-play/types';
import { UserEntity } from '../entities/user.entity';

export type UpdateRoleResult =
  | { kind: 'ok'; user: UserEntity; changed: boolean }
  | { kind: 'not_found' }
  | { kind: 'last_admin' };

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity, 'platform')
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(data: Partial<UserEntity>): Promise<UserEntity> {
    const user = this.repository.create(data);
    return this.repository.save(user);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  async findPaginated(options: {
    page: number;
    limit: number;
    q?: string;
  }): Promise<{ users: UserEntity[]; total: number }> {
    const qb = this.repository
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);

    const term = options.q?.trim();
    if (term) {
      qb.andWhere('(u.email ILIKE :q OR u.display_name ILIKE :q)', {
        q: `%${term}%`,
      });
    }

    const [users, total] = await qb.getManyAndCount();
    return { users, total };
  }

  async countAdmins(): Promise<number> {
    return this.repository.count({ where: { role: Role.ADMIN } });
  }

  /**
   * Atomically update role with last-admin guard (pessimistic locks).
   * Same-role requests are no-ops (no updatedAt/updatedBy stamp).
   */
  async updateRoleWithLastAdminGuard(params: {
    userId: string;
    newRole: Role;
    actingAdminId: string;
  }): Promise<UpdateRoleResult> {
    return this.repository.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);

      const target = await userRepo.findOne({
        where: { id: params.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!target) {
        return { kind: 'not_found' };
      }

      if (target.role === params.newRole) {
        return { kind: 'ok', user: target, changed: false };
      }

      if (target.role === Role.ADMIN && params.newRole === Role.USER) {
        const admins = await userRepo.find({
          where: { role: Role.ADMIN },
          lock: { mode: 'pessimistic_write' },
        });
        if (admins.length <= 1) {
          return { kind: 'last_admin' };
        }
      }

      target.role = params.newRole;
      target.updatedBy = params.actingAdminId;
      const saved = await userRepo.save(target);
      return { kind: 'ok', user: saved, changed: true };
    });
  }
}
