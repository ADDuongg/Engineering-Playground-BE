import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserLabCompletionEntity } from '../entities/user-lab-completion.entity';

@Injectable()
export class UserLabCompletionRepository {
  constructor(
    @InjectRepository(UserLabCompletionEntity, 'platform')
    private readonly repository: Repository<UserLabCompletionEntity>,
  ) {}

  async findByUserAndLab(
    userId: string,
    labId: string,
  ): Promise<UserLabCompletionEntity | null> {
    return this.repository.findOne({ where: { userId, labId } });
  }

  async listByUserAndTrackId(
    userId: string,
    trackId: string,
  ): Promise<UserLabCompletionEntity[]> {
    return this.repository
      .createQueryBuilder('completion')
      .innerJoinAndSelect('completion.lab', 'lab')
      .where('completion.user_id = :userId', { userId })
      .andWhere('lab.track_id = :trackId', { trackId })
      .getMany();
  }

  /**
   * Inserts a completion or returns the existing row on unique conflict.
   * @returns created=true when a new row was inserted
   */
  async createOrGetExisting(input: {
    userId: string;
    labId: string;
    completedAt: Date;
  }): Promise<{ entity: UserLabCompletionEntity; created: boolean }> {
    const existing = await this.findByUserAndLab(input.userId, input.labId);
    if (existing) {
      return { entity: existing, created: false };
    }

    try {
      const entity = this.repository.create({
        userId: input.userId,
        labId: input.labId,
        completedAt: input.completedAt,
      });
      const saved = await this.repository.save(entity);
      return { entity: saved, created: true };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await this.findByUserAndLab(input.userId, input.labId);
        if (raced) {
          return { entity: raced, created: false };
        }
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
