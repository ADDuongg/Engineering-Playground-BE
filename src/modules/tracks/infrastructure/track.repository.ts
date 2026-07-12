import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';
import { TrackEntity } from '../entities/track.entity';

export interface CreateTrackData {
  slug: string;
  name: string;
  description: string;
  status: TrackStatus;
  displayOrder: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: string;
  visualizationKitId: string;
}

export type UpdateTrackData = Partial<
  Omit<CreateTrackData, 'slug'>
>;

@Injectable()
export class TrackRepository {
  constructor(
    @InjectRepository(TrackEntity, 'platform')
    private readonly repository: Repository<TrackEntity>,
  ) {}

  async findAllOrdered(): Promise<TrackEntity[]> {
    return this.repository.find({
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<TrackEntity | null> {
    return this.repository.findOne({ where: { slug } });
  }

  async create(data: CreateTrackData): Promise<TrackEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(
    entity: TrackEntity,
    data: UpdateTrackData,
  ): Promise<TrackEntity> {
    Object.assign(entity, data);
    return this.repository.save(entity);
  }
}
