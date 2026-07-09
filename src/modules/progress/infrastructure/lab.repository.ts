import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabEntity } from '../entities/lab.entity';

@Injectable()
export class LabRepository {
  constructor(
    @InjectRepository(LabEntity, 'platform')
    private readonly repository: Repository<LabEntity>,
  ) {}

  async findBySlug(slug: string): Promise<LabEntity | null> {
    return this.repository.findOne({
      where: { slug },
      relations: { track: true },
    });
  }

  async findOrderedByTrackId(trackId: string): Promise<LabEntity[]> {
    return this.repository.find({
      where: { trackId },
      order: { sequenceOrder: 'ASC', slug: 'ASC' },
    });
  }

  async findOrderedByTrackSlug(trackSlug: string): Promise<LabEntity[]> {
    return this.repository
      .createQueryBuilder('lab')
      .innerJoinAndSelect('lab.track', 'track')
      .where('track.slug = :trackSlug', { trackSlug })
      .orderBy('lab.sequence_order', 'ASC')
      .addOrderBy('lab.slug', 'ASC')
      .getMany();
  }
}
