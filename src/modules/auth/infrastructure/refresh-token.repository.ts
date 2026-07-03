import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenEntity, 'platform')
    private readonly repository: Repository<RefreshTokenEntity>,
  ) {}

  async create(data: Partial<RefreshTokenEntity>): Promise<RefreshTokenEntity> {
    const token = this.repository.create(data);
    return this.repository.save(token);
  }

  async findValidByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.repository.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
      },
      relations: ['user'],
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.repository.update(id, { revokedAt: new Date() });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
