import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabStatus } from '@db-play/types';
import { LabEntity } from '../entities/lab.entity';

export interface CreateLabData {
  slug: string;
  title: string;
  description: string | null;
  trackId: string;
  sequenceOrder: number;
  status: LabStatus;
}

export type UpdateLabData = Partial<
  Pick<CreateLabData, 'title' | 'description' | 'sequenceOrder' | 'status'>
>;

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
      relations: { track: true },
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

  async create(data: CreateLabData): Promise<LabEntity> {
    const entity = this.repository.create(data);
    const saved = await this.repository.save(entity);
    const withTrack = await this.findBySlug(saved.slug);
    return withTrack ?? saved;
  }

  async update(entity: LabEntity, data: UpdateLabData): Promise<LabEntity> {
    Object.assign(entity, data);
    const saved = await this.repository.save(entity);
    const withTrack = await this.findBySlug(saved.slug);
    return withTrack ?? saved;
  }
}
